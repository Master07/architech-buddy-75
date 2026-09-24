select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'design-queue-recovery-sweep'),
  command := $$
  select net.http_post(
    url := 'https://project--fdecd64c-45d1-4923-84db-723218e31d6c-dev.lovable.app/api/public/v1/jobs/design',
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