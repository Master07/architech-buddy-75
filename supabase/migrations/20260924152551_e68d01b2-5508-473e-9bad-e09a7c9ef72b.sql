-- lovable-cron-fallback-reviewed: the external AI queue must resume independently after the enqueue request closes; one-minute reconciliation gives a bounded startup delay and recovers interrupted workers
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.design_worker_credentials (
  singleton boolean primary key default true check (singleton),
  token text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
revoke all on private.design_worker_credentials from public, anon, authenticated;
grant select on private.design_worker_credentials to service_role;

insert into private.design_worker_credentials (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.verify_design_worker_token(_token text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from private.design_worker_credentials
    where singleton = true
      and token = _token
  );
$$;
revoke all on function public.verify_design_worker_token(text) from public, anon, authenticated;
grant execute on function public.verify_design_worker_token(text) to service_role;

select cron.schedule(
  'design-queue-recovery-sweep',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://sda.corbetai.com/api/public/v1/jobs/design',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select token from private.design_worker_credentials where singleton = true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  )
  where exists (
    select 1
    from public.design_jobs
    where status = 'queued'
       or (status = 'running' and locked_at < now() - interval '10 minutes')
  );
  $$
);