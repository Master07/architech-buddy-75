create table if not exists public.design_jobs (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  prompt text not null,
  source text not null default 'api',
  bypass_rls boolean not null default false,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.design_jobs to authenticated;
grant all on public.design_jobs to service_role;

alter table public.design_jobs enable row level security;

create policy "Users read own design jobs"
on public.design_jobs for select to authenticated
using (auth.uid() = user_id);

create index if not exists design_jobs_pending_idx on public.design_jobs (status, created_at);
create index if not exists design_jobs_design_idx on public.design_jobs (design_id);

create or replace function public.claim_design_job()
returns setof public.design_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.design_jobs
     set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
         last_error = coalesce(last_error, 'Worker timed out'),
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
         locked_at = now(),
         updated_at = now()
    from next_job
   where j.id = next_job.id
  returning j.*;
end;
$$;

revoke all on function public.claim_design_job() from public, anon, authenticated;
grant execute on function public.claim_design_job() to service_role;