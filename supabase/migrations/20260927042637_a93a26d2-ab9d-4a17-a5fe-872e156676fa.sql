CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.waitlist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);
GRANT SELECT, UPDATE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own waitlist entry" ON public.waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins decide waitlist" ON public.waitlist FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.waitlist WHERE user_id = _user_id AND status = 'approved')
$$;

-- Existing users keep access; new users start pending.
INSERT INTO public.waitlist (user_id, email, status, decided_at)
SELECT id, email, 'approved', now() FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'navneet.jha07@gmail.com' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.waitlist (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Waitlisted users cannot touch app data (restrictive, combined with existing policies).
CREATE POLICY "Approved users only" ON public.threads AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.messages AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.designs AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.documents AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.document_chunks AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.context_items AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.api_keys AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved users only" ON public.ai_providers AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));