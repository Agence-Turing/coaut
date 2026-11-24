-- Thèmes des livres : une seule forme par thème (recette du 24/11, « aventure » et « Aventure »
-- en double dans les filtres, faute « Amitiè »). Même règle que src/lib/themes.ts et que
-- clean_theme() de scripts/import-notion.py : espaces réduits, première lettre en majuscule,
-- fautes connues corrigées, doublons retirés (casse ignorée, premier gardé). Rejouable.
create or replace function public.normaliser_theme(t text) returns text
language sql immutable as $$
  select case lower(x) when 'amitiè' then 'Amitié' when 'amitie' then 'Amitié'
              else upper(left(x, 1)) || substr(x, 2) end
  from (select regexp_replace(btrim(t), '\s+', ' ', 'g') as x) s
$$;

with n as (
  select b.id,
         coalesce(array(
           select th from (
             select distinct on (lower(public.normaliser_theme(e.t)))
                    public.normaliser_theme(e.t) as th, e.ord
             from unnest(b.themes) with ordinality as e(t, ord)
             where btrim(e.t) <> ''
             order by lower(public.normaliser_theme(e.t)), e.ord
           ) d order by d.ord
         ), '{}') as themes
  from public.books b
)
update public.books b set themes = n.themes
from n where b.id = n.id and b.themes is distinct from n.themes;
