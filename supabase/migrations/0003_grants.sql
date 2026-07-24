-- Droits d'accès des rôles API Supabase sur le schéma public.
-- (non appliqués par défaut sur ce projet — sans eux, PostgREST renvoie "permission denied")

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;

-- Pour que les futures tables héritent des mêmes droits :
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant all on tables to authenticated;
