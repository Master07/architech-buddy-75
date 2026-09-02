CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role, anon;
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER DATABASE postgres SET search_path TO "\$user", public, extensions;