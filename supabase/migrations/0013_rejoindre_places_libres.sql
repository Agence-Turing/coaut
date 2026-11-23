-- Rejoindre un livre : seulement s'il reste une place (retour de Juliette du 20/11 : des livres
-- en cours d'écriture dans l'ancien site apparaissaient « à rejoindre »). Rejouable sans risque.
-- Même règle que openToJoin() dans src/lib/books.ts.
--
-- Un livre est ouvert aux demandes s'il est en cours (launched), public (pas de classe) et que
-- son équipe n'a pas atteint le nombre de places (max_players ; null = livre « Lancé » repris
-- de l'ancien site, ouvert). Les livres « Commencé » de l'ancien site reçoivent à la reprise
-- max_players = taille de l'équipe (scripts/import-notion.py) : ils sont donc fermés.

-- 1. Le livre accepte-t-il encore des co-auteurs ? security definer : lu depuis les policies.
create or replace function public.book_open_to_join(p_book uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select b.status = 'launched'
       and b.class_id is null
       and (b.max_players is null
            or (select count(*) from public.book_players bp where bp.book_id = b.id) < b.max_players)
    from public.books b
    where b.id = p_book
  ), false);
$$;

revoke all on function public.book_open_to_join(uuid) from public;
grant execute on function public.book_open_to_join(uuid) to anon, authenticated, service_role;

-- 2. Demande à rejoindre refusée par la base pour un livre fermé, même par l'API Supabase.
--    Policy restrictive : elle s'ajoute (ET) à « demander a rejoindre ».
drop policy if exists "livre ouvert (demander)" on public.join_requests;
create policy "livre ouvert (demander)" on public.join_requests
  as restrictive for insert to authenticated
  with check (public.book_open_to_join(book_id));

-- 3. Le lanceur ne peut pas ajouter un co-auteur au-delà du nombre de places (livre public).
--    La fonction ne voit pas la ligne en cours d'insertion : « ouvert » = encore une place libre.
--    Les livres de classe (équipe montée par le prof) et l'administration (service_role, hors
--    RLS) ne sont pas concernés.
drop policy if exists "livre ouvert (equipe)" on public.book_players;
create policy "livre ouvert (equipe)" on public.book_players
  as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.books b where b.id = book_id and b.class_id is not null)
    or public.book_open_to_join(book_id)
  );
