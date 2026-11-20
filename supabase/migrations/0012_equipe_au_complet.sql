-- Équipe au complet avant d'écrire la suite (retour de Juliette du 20/11 : « je peux écrire
-- seule »). Rejouable sans risque. Même règle que teamWaiting() dans src/lib/books.ts.
--
-- Le lanceur écrit le tour 1 ; ensuite personne n'écrit tant que l'équipe n'a pas atteint le
-- nombre de co-auteurs choisi au lancement (books.max_players). La règle vaut à chaque tour :
-- si un co-auteur quitte le livre en route, l'écriture s'arrête jusqu'à ce qu'une place soit
-- reprise (ou que l'administration baisse le nombre de co-auteurs).
-- Hors règle : livres de classe (équipe = la classe, montée par le prof) et livres repris de
-- l'ancien site (max_players null : le nombre souhaité n'y existait pas).

-- 1. Le livre attend-il son équipe ? security definer : lu depuis les policies de turns.
create or replace function public.book_waiting_for_team(p_book uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select b.status = 'launched'
       and b.class_id is null
       and b.max_players is not null
       and (select count(*) from public.book_players bp where bp.book_id = b.id) < b.max_players
       and exists (select 1 from public.turns t where t.book_id = b.id and t.is_ended)
    from public.books b
    where b.id = p_book
  ), false);
$$;

revoke all on function public.book_waiting_for_team(uuid) from public;
grant execute on function public.book_waiting_for_team(uuid) to anon, authenticated, service_role;

-- 2. Écriture refusée par la base, même en passant directement par l'API Supabase.
--    Policies restrictives : elles s'ajoutent (ET) aux policies d'écriture existantes.
drop policy if exists "equipe au complet (ecrire)" on public.turns;
create policy "equipe au complet (ecrire)" on public.turns
  as restrictive for insert to authenticated
  with check (not public.book_waiting_for_team(book_id));

-- Terminer ou modifier un tour : seul le tour 1 reste modifiable pendant l'attente.
drop policy if exists "equipe au complet (modifier)" on public.turns;
create policy "equipe au complet (modifier)" on public.turns
  as restrictive for update to authenticated
  using (true)
  with check (number = 1 or not public.book_waiting_for_team(book_id));

-- 3. À qui le tour (administration) : personne tant que le livre attend son équipe, comme
--    writingState(). Ajouter un co-auteur pendant l'attente ne fige donc plus le lanceur comme
--    prochain auteur (admin_rebalance reçoit null et ne fait que compacter l'ordre).
create or replace function public.admin_current_writer(p_book uuid)
returns uuid
language plpgsql stable
set search_path = public
as $$
declare
  v_open uuid;
  v_n integer;
  v_e integer;
begin
  -- Livre de classe relu par le prof : un tour terminé non validé bloque la rotation
  -- (pendingReviewOf dans src/lib/books.ts) ; personne n'a la main.
  if exists (
    select 1 from public.books b join public.turns t on t.book_id = b.id
    where b.id = p_book and b.teacher_review and t.is_ended and not t.is_validated
      and t.content is not null
  ) then
    return null;
  end if;
  -- Équipe pas au complet après le premier tour : personne n'a la main.
  if public.book_waiting_for_team(p_book) then
    return null;
  end if;
  if exists (select 1 from public.turns where book_id = p_book and not is_ended) then
    select t.author_id into v_open from public.turns t
    where t.book_id = p_book and not t.is_ended order by t.number limit 1;
    return v_open;
  end if;
  select count(*) into v_n from public.book_players where book_id = p_book;
  if v_n = 0 then return null; end if;
  select count(*) into v_e from public.turns where book_id = p_book and is_ended;
  return (select author_id from public.admin_team(p_book) where idx = v_e % v_n);
end $$;

revoke all on function public.admin_current_writer(uuid) from public, anon, authenticated;
grant execute on function public.admin_current_writer(uuid) to service_role;

notify pgrst, 'reload schema';
