-- Admin-scoped vector search used by API-key authenticated requests (service_role bypasses RLS,
-- so this function pins the owner explicitly instead of relying on auth.uid()).
create or replace function public.match_document_chunks_for_user(
  p_user_id uuid,
  query_embedding text,
  match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  section text,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.title as document_title,
    c.section,
    c.content,
    1 - (c.embedding <=> query_embedding::extensions.vector) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = p_user_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding::extensions.vector
  limit greatest(1, least(coalesce(match_count, 6), 20));
$$;

revoke all on function public.match_document_chunks_for_user(uuid, text, int) from public, anon, authenticated;
grant execute on function public.match_document_chunks_for_user(uuid, text, int) to service_role;