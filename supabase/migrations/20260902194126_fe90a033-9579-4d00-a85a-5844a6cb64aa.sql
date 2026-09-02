DROP FUNCTION IF EXISTS public.match_document_chunks(extensions.vector, integer);

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding extensions.vector(1536),
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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
  SELECT c.id, c.document_id, d.title, c.section, c.content,
         1 - (c.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.document_chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 20));
$$;
REVOKE ALL ON FUNCTION public.match_document_chunks(extensions.vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(extensions.vector, integer) TO authenticated, service_role;