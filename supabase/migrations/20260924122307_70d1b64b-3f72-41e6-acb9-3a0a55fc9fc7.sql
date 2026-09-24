ALTER TABLE public.design_jobs
  DROP CONSTRAINT IF EXISTS design_jobs_status_check;

ALTER TABLE public.design_jobs
  ADD CONSTRAINT design_jobs_status_check
  CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.claim_design_job()
RETURNS SETOF public.design_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.design_jobs
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
         last_error = COALESCE(last_error, 'Worker timed out'),
         finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END,
         locked_at = NULL,
         current_stage = NULL,
         updated_at = now()
   WHERE status = 'running'
     AND locked_at < now() - interval '10 minutes';

  RETURN QUERY
  WITH next_job AS (
    SELECT id FROM public.design_jobs
     WHERE status = 'queued' AND attempts < max_attempts
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.design_jobs j
     SET status = 'running',
         attempts = j.attempts + 1,
         started_at = COALESCE(j.started_at, now()),
         locked_at = now(),
         updated_at = now()
    FROM next_job
   WHERE j.id = next_job.id
  RETURNING j.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_design_job() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_design_job() TO service_role;