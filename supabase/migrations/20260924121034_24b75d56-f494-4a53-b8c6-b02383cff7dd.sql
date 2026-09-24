alter table public.design_jobs
  add column if not exists current_stage text,
  add column if not exists stages_done integer not null default 0,
  add column if not exists stage_started_at timestamptz;