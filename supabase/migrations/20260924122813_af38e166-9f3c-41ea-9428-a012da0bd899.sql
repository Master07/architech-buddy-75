ALTER TABLE public.design_jobs ADD COLUMN api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL;
CREATE INDEX design_jobs_api_key_id_idx ON public.design_jobs(api_key_id);