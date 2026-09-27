CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  use_case text,
  note text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX waitlist_signups_email_key ON public.waitlist_signups (lower(email));
GRANT SELECT ON public.waitlist_signups TO authenticated;
GRANT ALL ON public.waitlist_signups TO service_role;
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sign-ups" ON public.waitlist_signups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));