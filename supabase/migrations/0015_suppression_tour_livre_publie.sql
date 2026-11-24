-- Suppression d'un tour par l'administration (recette du 24/11, n°12) : sur un livre publié ou
-- archivé, plus personne n'écrit, donc pas de recalage de la rotation (il faisait tourner les
-- positions de l'équipe : le lanceur passait en dernier à l'affichage). Sur un livre en cours,
-- inchangé (0010) : l'auteur dont c'est le tour reste le même. Rejouable.
create or replace function public.admin_delete_turn(p_turn uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_book uuid;
  v_number integer;
  v_cur uuid;
  v_launched boolean;
begin
  select t.book_id, t.number, b.status = 'launched' into v_book, v_number, v_launched
  from public.turns t join public.books b on b.id = t.book_id where t.id = p_turn;
  if v_book is null then raise exception 'tour introuvable'; end if;
  if v_launched then v_cur := public.admin_current_writer(v_book); end if;
  delete from public.turns where id = p_turn;
  -- En deux temps : la contrainte unique (book_id, number) n'est pas différable.
  update public.turns set number = -number where book_id = v_book and number > v_number;
  update public.turns set number = -number - 1 where book_id = v_book and number < 0;
  if v_launched then perform public.admin_rebalance(v_book, v_cur); end if;
end $$;

revoke all on function public.admin_delete_turn(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_turn(uuid) to service_role;
notify pgrst, 'reload schema';
