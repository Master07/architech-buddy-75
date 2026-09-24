-- lovable-cron-fallback-reviewed: the one-minute sweep is only a backstop for interrupted steps; normal progress is driven by wake-ups on enqueue and on every completed step
alter table public.design_jobs
  add column if not exists pipeline_state jsonb not null default '{}'::jsonb,
  add column if not exists not_before timestamptz;

create table if not exists private.design_queue_state (
  singleton boolean primary key default true check (singleton),
  paused_until timestamptz,
  paused_reason text,
  worker_url text not null default 'https://project--fdecd64c-45d1-4923-84db-723218e31d6c.lovable.app/api/public/v1/jobs/design'
);
revoke all on private.design_queue_state from public, anon, authenticated;
grant select, insert, update on private.design_queue_state to service_role;
insert into private.design_queue_state (singleton) values (true) on conflict (singleton) do nothing;

-- Old whole-pipeline claimer is retired so an older deployed worker can never grab jobs.
create or replace function public.claim_design_job()
returns setof public.design_jobs
language sql
security definer
set search_path = public
as $$ select * from public.design_jobs where false $$;

-- Claims up to _limit runnable steps. A step is runnable when a job is queued, or
-- running with no live lease (between steps, or its worker stopped heartbeating).
create or replace function public.claim_design_steps(_limit integer default 4)
returns setof public.design_jobs
language plpgsql
security definer
set search_path = public, private
as $$
declare
  max_global constant integer := 10;
  max_per_system constant integer := 3;
  active integer;
  slots integer;
begin
  perform pg_advisory_xact_lock(hashtext('claim_design_steps'));

  if exists (select 1 from private.design_queue_state where paused_until > now()) then
    return;
  end if;

  -- Stale leases: the step's worker stopped heartbeating. Count it as a failed try of that step only.
  update public.design_jobs
     set locked_at = null,
         status = case when attempts >= max_attempts then 'failed' else status end,
         last_error = 'Step interrupted; retrying from the last saved step',
         finished_at = case when attempts >= max_attempts then now() else finished_at end,
         updated_at = now()
   where status = 'running' and locked_at < now() - interval '3 minutes';

  update public.designs d
     set status = 'failed', error = 'Step failed after repeated interruptions'
    from public.design_jobs j
   where j.design_id = d.id and j.status = 'failed' and d.status = 'running';

  select count(*) into active from public.design_jobs where status = 'running' and locked_at is not null;
  slots := least(greatest(coalesce(_limit, 4), 1), 10, max_global - active);
  if slots <= 0 then return; end if;

  return query
  with busy as (
    select coalesce(api_key_id::text, user_id::text) as sys, count(*) as n
      from public.design_jobs
     where status = 'running' and locked_at is not null
     group by 1
  ),
  candidates as (
    select j.id,
           coalesce(j.api_key_id::text, j.user_id::text) as sys,
           row_number() over (partition by coalesce(j.api_key_id::text, j.user_id::text) order by j.created_at) as rn,
           j.created_at
      from public.design_jobs j
     where (j.status = 'queued' or (j.status = 'running' and j.locked_at is null))
       and (j.not_before is null or j.not_before <= now())
  ),
  picked as (
    select c.id from candidates c
      left join busy b on b.sys = c.sys
     where c.rn + coalesce(b.n, 0) <= max_per_system
     order by c.rn, c.created_at
     limit slots
  )
  update public.design_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         started_at = coalesce(j.started_at, now()),
         locked_at = now(),
         not_before = null,
         updated_at = now()
    from picked
   where j.id = picked.id
     and (j.status = 'queued' or (j.status = 'running' and j.locked_at is null))
  returning j.*;
end;
$$;
revoke all on function public.claim_design_steps(integer) from public, anon, authenticated;
grant execute on function public.claim_design_steps(integer) to service_role;

-- Wakes one worker. The long timeout keeps the connection (and so the worker) alive for a whole step.
create or replace function public.kick_design_worker()
returns void
language sql
security definer
set search_path = public, private
as $$
  select net.http_post(
    url := (select worker_url from private.design_queue_state where singleton = true),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select token from private.design_worker_credentials where singleton = true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 900000
  );
$$;
revoke all on function public.kick_design_worker() from public, anon, authenticated;
grant execute on function public.kick_design_worker() to service_role;

create or replace function public.pause_design_queue(_minutes integer, _reason text)
returns void
language sql
security definer
set search_path = public, private
as $$
  update private.design_queue_state
     set paused_until = now() + make_interval(mins => greatest(1, least(_minutes, 1440))),
         paused_reason = left(_reason, 500)
   where singleton = true;
$$;
revoke all on function public.pause_design_queue(integer, text) from public, anon, authenticated;
grant execute on function public.pause_design_queue(integer, text) to service_role;

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'design-queue-recovery-sweep'),
  command := $$
  select public.kick_design_worker()
  where not exists (select 1 from private.design_queue_state where paused_until > now())
    and exists (
      select 1 from public.design_jobs
       where (not_before is null or not_before <= now())
         and (status = 'queued'
              or (status = 'running' and (locked_at is null or locked_at < now() - interval '3 minutes')))
    );
  $$
);