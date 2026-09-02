REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.match_document_chunks(vector, integer, uuid);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  document_title TEXT,
  section TEXT,
  content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.document_id, d.title, c.section, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;
REVOKE ALL ON FUNCTION public.match_document_chunks(vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, integer) TO authenticated, service_role;