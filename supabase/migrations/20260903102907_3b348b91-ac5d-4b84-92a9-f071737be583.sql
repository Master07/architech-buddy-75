create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'design-queue-recovery-sweep',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://project--fdecd64c-45d1-4923-84db-723218e31d6c.lovable.app/api/public/v1/jobs/design',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.design_jobs
     where status = 'queued'
        or (status = 'running' and locked_at < now() - interval '10 minutes')
  );
  $$
);