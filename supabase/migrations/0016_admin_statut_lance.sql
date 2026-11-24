-- Statut « Lancé » dans l'administration (retour de Juliette du 24/11) : distinguer les livres
-- en cours qui recrutent encore (visibles dans « Rejoindre un livre ») de ceux dont l'équipe
-- est au complet. Ajoute la colonne open_to_join en fin de vue admin_books, même règle que
-- book_open_to_join() (0013) et openToJoin() côté app. Rejouable.
create or replace view public.admin_books as
select
  b.id, b.legacy_code, b.title, b.synopsis, b.status, b.max_players, b.created_at,
  b.launcher_id, la.nickname as launcher_nickname, b.cover_path,
  (select count(*) from public.book_players bp where bp.book_id = b.id)::integer as players_count,
  coalesce(tc.turns_count, 0)::integer as turns_count,
  tc.last_turn_at,
  coalesce(tc.last_turn_at, b.created_at) as last_activity_at,
  cw.author_id as current_writer_id,
  ca.nickname as current_writer_nickname,
  b.class_id, cl.name as class_name, b.teacher_review,
  (b.status = 'launched'
    and b.class_id is null
    and (b.max_players is null
         or (select count(*) from public.book_players bp where bp.book_id = b.id) < b.max_players)
  ) as open_to_join
from public.books b
left join public.authors la on la.id = b.launcher_id
left join public.classes cl on cl.id = b.class_id
left join lateral (
  select count(*) filter (where t.is_ended) as turns_count, max(t.created_at) as last_turn_at
  from public.turns t where t.book_id = b.id
) tc on true
left join lateral (
  select case when b.status = 'launched' then public.admin_current_writer(b.id) end as author_id
) cw on true
left join public.authors ca on ca.id = cw.author_id;

revoke all on public.admin_books from public, anon, authenticated;
grant select on public.admin_books to service_role;
