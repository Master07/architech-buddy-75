alter table public.design_jobs
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists resubmitted_from uuid references public.design_jobs(id) on delete set null;

create or replace function public.claim_design_job()
 returns setof design_jobs
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.design_jobs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         last_error = coalesce(last_error, 'Worker timed out'),
         finished_at = case when attempts >= max_attempts then now() else null end,
         locked_at = null,
         updated_at = now()
   where status = 'running'
     and locked_at < now() - interval '10 minutes';

  return query
  with next_job as (
    select id from public.design_jobs
     where status = 'queued' and attempts < max_attempts
     order by created_at
     for update skip locked
     limit 1
  )
  update public.design_jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         started_at = coalesce(j.started_at, now()),
         locked_at = now(),
         updated_at = now()
    from next_job
   where j.id = next_job.id
  returning j.*;
end;
$function$;

revoke execute on function public.claim_design_job() from public, anon, authenticated;