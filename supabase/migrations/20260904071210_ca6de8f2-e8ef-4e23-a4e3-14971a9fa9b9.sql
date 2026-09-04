CREATE TABLE public.context_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX context_items_thread_idx ON public.context_items (thread_id, created_at);
CREATE INDEX context_items_user_idx ON public.context_items (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.context_items TO authenticated;
GRANT ALL ON public.context_items TO service_role;

ALTER TABLE public.context_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own context items"
  ON public.context_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER context_items_updated_at
  BEFORE UPDATE ON public.context_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();