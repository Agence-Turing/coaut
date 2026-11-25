-- Réunion avec Juliette du 24/11, trois retours. Rejouable sans risque. À passer après 0016.
--
-- 1. L'administration fait d'un co-auteur le lanceur du livre (lanceur parti) : admin_set_launcher.
-- 2. Le lanceur change lui-même le nombre de co-auteurs de son livre, et l'annule tant que
--    personne n'a écrit : garde-fous en base (trigger sur books.max_players, policy de suppression).
-- 3. Tours en retard dans l'administration : books.turn_started_at (début du tour en cours) et
--    colonnes waiting_since, current_turn_number, draft_started_at en fin de vue admin_books.

-- 0. Début du tour en cours ---------------------------------------------------------------------
-- Date à laquelle l'auteur dont c'est le tour a reçu la main : fin du tour précédent, tour passé
-- ou co-auteur retiré par l'administration, équipe qui vient d'être au complet, nouveau lanceur
-- d'un livre sans tour. null = jamais renseigné (livres repris : on se rabat sur le dernier tour).
-- Seuls les changements faits par l'app (rôles authenticated et service_role) la mettent à jour :
-- la reprise Notion (psql en postgres) garde les dates d'origine des tours.
alter table public.books add column if not exists turn_started_at timestamptz;

update public.books b
set turn_started_at = greatest(b.created_at, (select max(t.created_at) from public.turns t where t.book_id = b.id and t.is_ended))
where b.turn_started_at is null;

create or replace function public.touch_turn_started(p_book uuid, p_at timestamptz default now())
returns void
language sql security definer
set search_path = public
as $$
  update public.books
  set turn_started_at = greatest(coalesce(turn_started_at, '-infinity'::timestamptz), p_at)
  where id = p_book;
$$;
revoke all on function public.touch_turn_started(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.touch_turn_started(uuid, timestamptz) to service_role;

-- Un changement fait par l'app ? (pas la reprise Notion ni une opération à la main en psql)
-- PostgREST passe en « set local role authenticated|service_role » : le paramètre role garde
-- cette valeur même dans une fonction security definer (current_user, lui, devient postgres).
create or replace function public.app_session()
returns boolean
language sql stable
as $$ select coalesce(current_setting('role', true), 'none') in ('authenticated', 'service_role'); $$;

-- Tour terminé : le suivant a la main à partir de maintenant.
create or replace function public.turns_touch_turn_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_session() and new.is_ended and (tg_op = 'INSERT' or not old.is_ended) then
    perform public.touch_turn_started(new.book_id, case when tg_op = 'INSERT' then new.created_at else now() end);
  end if;
  return new;
end $$;

drop trigger if exists turns_touch_turn_started on public.turns;
create trigger turns_touch_turn_started
  after insert or update of is_ended on public.turns
  for each row execute function public.turns_touch_turn_started();

-- Co-auteur qui complète l'équipe d'un livre déjà commencé : l'écriture reprend maintenant.
create or replace function public.book_players_touch_turn_started()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_session() and exists (
    select 1 from public.books b
    where b.id = new.book_id and b.status = 'launched' and b.class_id is null
      and b.max_players is not null
      and (select count(*) from public.book_players bp where bp.book_id = b.id) = b.max_players
      and exists (select 1 from public.turns t where t.book_id = b.id and t.is_ended)
  ) then
    perform public.touch_turn_started(new.book_id);
  end if;
  return null;
end $$;

drop trigger if exists book_players_touch_turn_started on public.book_players;
create trigger book_players_touch_turn_started
  after insert on public.book_players
  for each row execute function public.book_players_touch_turn_started();

-- 1. Nombre de co-auteurs : garde-fous en base ----------------------------------------------------
-- Le lanceur peut modifier son livre (policy « update par le lanceur ») : sans ce trigger il
-- pourrait poser n'importe quel nombre de places par l'API Supabase. Pour lui (authenticated) :
-- livre public en cours, entre 2 et 10 (comme au lancement), jamais moins que l'équipe actuelle.
-- L'administration (service_role) garde sa plage 1-30, contrôlée par l'action serveur ; jamais
-- moins que l'équipe non plus. Places baissées jusqu'à l'équipe sur un livre commencé : le
-- livre reprend, le tour en cours démarre maintenant.
-- Fonction du rôle appelant (pas security definer) : current_user = authenticated pour le
-- lanceur, service_role pour l'administration, postgres pour la reprise Notion. Elle ne lit que
-- l'équipe et les tours du livre, lisibles par son lanceur.
create or replace function public.books_check_max_players()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_team integer;
begin
  if new.max_players is not distinct from old.max_players then return new; end if;
  select count(*) into v_team from public.book_players where book_id = new.id;
  if current_user in ('authenticated', 'anon') then
    if new.class_id is not null then
      raise exception 'livre de classe : le nombre de places suit la classe';
    end if;
    if new.status <> 'launched' then
      raise exception 'livre qui n''est plus en cours : nombre de places figé';
    end if;
    if new.max_players is null or new.max_players < 2 or new.max_players > 10 then
      raise exception 'nombre de co-auteurs entre 2 et 10';
    end if;
  end if;
  if new.max_players is not null and new.max_players < v_team then
    raise exception 'pas moins de places que de co-auteurs dans l''équipe (%)', v_team;
  end if;
  -- Livre commencé qui attendait son équipe et qui est maintenant au complet : il reprend.
  if public.app_session()
     and new.status = 'launched' and new.class_id is null
     and new.max_players is not null and v_team >= new.max_players
     and old.max_players is not null and v_team < old.max_players
     and exists (select 1 from public.turns t where t.book_id = new.id and t.is_ended) then
    new.turn_started_at := now();
  end if;
  return new;
end $$;

drop trigger if exists books_check_max_players on public.books;
create trigger books_check_max_players
  before update of max_players on public.books
  for each row execute function public.books_check_max_players();

-- 2. Annuler son livre (lanceur) tant que personne n'a écrit -----------------------------------
-- Annulable : livre en cours, aucun tour terminé, et pas de brouillon d'un autre que le lanceur
-- (son propre brouillon du tour 1 part avec le livre). security definer : lu depuis la policy.
create or replace function public.book_cancellable(p_book uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select b.status = 'launched'
       and not exists (
         select 1 from public.turns t
         where t.book_id = b.id and (t.is_ended or t.author_id is distinct from b.launcher_id)
       )
    from public.books b
    where b.id = p_book
  ), false);
$$;
revoke all on function public.book_cancellable(uuid) from public;
grant execute on function public.book_cancellable(uuid) to anon, authenticated, service_role;

-- Suppression par le lanceur (livre public ou de classe) ; équipe, demandes, brouillon, favoris
-- et journal des mails suivent (on delete cascade). Seule policy de suppression sur books :
-- l'administration passe par service_role, hors RLS.
drop policy if exists "annuler par le lanceur" on public.books;
create policy "annuler par le lanceur" on public.books
  for delete to authenticated
  using (launcher_id = (select public.my_author_id()) and public.book_cancellable(id));

-- 3. Changer le lanceur (administration) ------------------------------------------------------
-- p_author doit être dans l'équipe d'un livre public. Il reçoit les droits du lanceur (demandes
-- à rejoindre et leurs mails, publication, nombre de places, annulation). L'ancien lanceur reste
-- co-auteur s'il est encore dans l'équipe. « À qui le tour » ne change pas, sauf sur un livre
-- où rien n'est encore écrit (aucun tour, même en brouillon) : le nouveau lanceur écrit le
-- tour 1, comme au lancement.
create or replace function public.admin_set_launcher(p_book uuid, p_author uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_book public.books%rowtype;
begin
  select * into v_book from public.books where id = p_book for update;
  if v_book.id is null then raise exception 'livre introuvable'; end if;
  if v_book.class_id is not null then raise exception 'livre de classe : le lanceur est le prof'; end if;
  if not exists (select 1 from public.book_players where book_id = p_book and author_id = p_author) then
    raise exception 'pas dans l''équipe';
  end if;
  if v_book.launcher_id = p_author then return; end if;
  update public.books set launcher_id = p_author where id = p_book;
  -- Sa demande à rejoindre (acceptée) ne le concerne plus comme lanceur : rien à faire. Les
  -- demandes en attente restent et lui reviennent.
  if v_book.status = 'launched' and not exists (select 1 from public.turns where book_id = p_book) then
    perform public.admin_rebalance(p_book, p_author);
    perform public.touch_turn_started(p_book);
  end if;
end $$;

-- 4. Le tour change de main par l'administration : début du tour en cours remis à maintenant.
create or replace function public.admin_pass_turn(p_book uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_cur uuid;
  v_next uuid;
  v_n integer;
begin
  select count(*) into v_n from public.book_players where book_id = p_book;
  if v_n < 2 then raise exception 'équipe trop petite'; end if;
  v_cur := public.admin_current_writer(p_book);
  v_next := public.admin_next_after(p_book, v_cur);
  delete from public.turns where book_id = p_book and not is_ended;
  -- Tour ouvert d'un auteur sorti de l'équipe (repris de l'ancien site) : la rotation reprend seule.
  if v_next is null then
    perform public.admin_rebalance(p_book, null);
  else
    perform public.admin_rebalance(p_book, v_next);
  end if;
  perform public.touch_turn_started(p_book);
  return public.admin_current_writer(p_book);
end $$;

create or replace function public.admin_remove_player(p_book uuid, p_author uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_cur uuid;
  v_next uuid;
begin
  if not exists (select 1 from public.book_players where book_id = p_book and author_id = p_author) then
    raise exception 'pas dans l''équipe';
  end if;
  v_cur := public.admin_current_writer(p_book);
  v_next := case when v_cur = p_author then public.admin_next_after(p_book, p_author) else v_cur end;
  delete from public.turns where book_id = p_book and author_id = p_author and not is_ended;
  delete from public.book_players where book_id = p_book and author_id = p_author;
  perform public.admin_rebalance(p_book, v_next);
  if v_cur = p_author then perform public.touch_turn_started(p_book); end if;
end $$;

-- 5. Vue des livres : début du tour en cours, numéro du tour attendu, brouillon commencé.
--    Colonnes ajoutées en fin de vue (create or replace view n'accepte que des ajouts à la fin).
--    waiting_since = la plus récente de : début du tour en cours, dernier tour terminé, lancement
--    (un brouillon commencé ne compte pas : le tour n'avance pas tant qu'il n'est pas envoyé).
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
  ) as open_to_join,
  b.turn_started_at,
  greatest(b.turn_started_at, tc.last_ended_at, b.created_at) as waiting_since,
  coalesce(tc.open_number, coalesce(tc.max_number, 0) + 1)::integer as current_turn_number,
  tc.draft_started_at
from public.books b
left join public.authors la on la.id = b.launcher_id
left join public.classes cl on cl.id = b.class_id
left join lateral (
  select count(*) filter (where t.is_ended) as turns_count, max(t.created_at) as last_turn_at,
         max(t.created_at) filter (where t.is_ended) as last_ended_at,
         max(t.number) as max_number,
         min(t.number) filter (where not t.is_ended) as open_number,
         min(t.created_at) filter (where not t.is_ended) as draft_started_at
  from public.turns t where t.book_id = b.id
) tc on true
left join lateral (
  select case when b.status = 'launched' then public.admin_current_writer(b.id) end as author_id
) cw on true
left join public.authors ca on ca.id = cw.author_id;

revoke all on public.admin_books from public, anon, authenticated;
grant select on public.admin_books to service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_set_launcher(uuid, uuid)', 'admin_pass_turn(uuid)', 'admin_remove_player(uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
