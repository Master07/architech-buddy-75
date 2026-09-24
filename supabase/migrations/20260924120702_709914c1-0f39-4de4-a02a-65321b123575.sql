create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid not null,
  kind text not null,
  design_id uuid references public.designs(id) on delete set null,
  thread_id uuid,
  label text,
  stage text,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now()
);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "Users read own AI usage" on public.ai_usage for select to authenticated using (auth.uid() = user_id);
create index ai_usage_user_created on public.ai_usage (user_id, created_at desc);
create index ai_usage_design on public.ai_usage (design_id);
create index ai_usage_request on public.ai_usage (request_id);