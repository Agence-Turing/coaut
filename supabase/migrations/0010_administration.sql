-- Administration (/admin, docs/administration.md). Rejouable sans risque.
-- À passer après 0009_livres_prives_eleves (classes, authors.kind, books.class_id).
--
-- Principe : rien n'est ouvert au client. Les pages d'administration lisent les vues admin_*
-- et appellent les fonctions admin_* avec la clé service (src/lib/supabase/admin.ts), après
-- avoir vérifié côté serveur que le compte connecté est dans public.admins.
-- Les vues et fonctions admin_* ne sont accessibles qu'au rôle service_role.

-- 1. Comptes administrateurs (un compte GoTrue = un administrateur). Invisible par l'API publique.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text, -- qui c'est (« Juliette », « compte de test »)
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant all on public.admins to service_role;

-- Le compte connecté est-il administrateur ? (sert à afficher le lien du menu ; la vraie
-- vérification des pages et actions se fait côté serveur avec la clé service).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Blocage d'un auteur : date dans le profil privé (aucun droit de colonne pour authenticated,
--    donc ni lisible ni modifiable par l'auteur). Le blocage coupe aussi le compte GoTrue (ban)
--    et ses sessions ; les politiques restrictives ci-dessous bloquent toute écriture au cas où
--    un jeton encore valide traînerait.
alter table public.author_profiles add column if not exists blocked_at timestamptz;

-- Auteur supprimé par l'administration : la fiche reste (ses tours restent dans les livres),
-- anonymisée, sans compte ni profil.
alter table public.authors add column if not exists deleted_at timestamptz;

create or replace function public.is_blocked_user()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.authors a
    join public.author_profiles p on p.author_id = a.id
    where a.user_id = auth.uid() and p.blocked_at is not null
  );
$$;
revoke all on function public.is_blocked_user() from public;
grant execute on function public.is_blocked_user() to anon, authenticated, service_role;

do $$
declare
  t text;
  cmd text;
begin
  foreach t in array array['authors', 'author_profiles', 'books', 'book_players', 'turns',
                           'join_requests', 'favorites', 'classes'] loop
    foreach cmd in array array['insert', 'update', 'delete'] loop
      execute format('drop policy if exists %I on public.%I', 'compte bloque : ' || cmd, t);
      if cmd = 'insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated
                        with check (not public.is_blocked_user())', 'compte bloque : ' || cmd, t);
      elsif cmd = 'update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated
                        using (not public.is_blocked_user()) with check (not public.is_blocked_user())',
                       'compte bloque : ' || cmd, t);
      else
        execute format('create policy %I on public.%I as restrictive for delete to authenticated
                        using (not public.is_blocked_user())', 'compte bloque : ' || cmd, t);
      end if;
    end loop;
  end loop;
end $$;

-- Coupe les sessions ouvertes d'un compte (blocage) : le jeton en cours n'est plus accepté par GoTrue.
create or replace function public.admin_revoke_sessions(p_user uuid)
returns void
language sql security definer
set search_path = public
as $$
  delete from auth.sessions where user_id = p_user;
$$;

-- Classe bloquée par l'administration : tous ses élèves sont bloqués (même mécanisme que
-- pour un auteur) ; la date sert d'indicateur et permet de débloquer.
alter table public.classes add column if not exists blocked_at timestamptz;

-- 3. Modération IA des tours (chantier à venir) : null = pas encore contrôlé.
alter table public.turns add column if not exists moderation_status text;
alter table public.turns add column if not exists moderation_reason text;
alter table public.turns add column if not exists moderated_at timestamptz;
alter table public.turns drop constraint if exists turns_moderation_status_check;
alter table public.turns add constraint turns_moderation_status_check
  check (moderation_status is null or moderation_status in ('ok', 'blocked', 'review'));

-- 4. À qui le tour : même règle que writingState() (src/lib/books.ts).
--    Relecture du prof en attente → personne ; tour ouvert → son auteur ;
--    sinon équipe triée par position, nb tours terminés % taille.
create or replace function public.admin_team(p_book uuid)
returns table (author_id uuid, idx integer)
language sql stable
set search_path = public
as $$
  select bp.author_id,
         (row_number() over (order by bp.position, bp.joined_at, bp.author_id) - 1)::integer
  from public.book_players bp
  where bp.book_id = p_book;
$$;

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

-- Auteur qui suit p_author dans l'ordre de passage (null si p_author n'est pas dans l'équipe).
create or replace function public.admin_next_after(p_book uuid, p_author uuid)
returns uuid
language sql stable
set search_path = public
as $$
  with team as (select * from public.admin_team(p_book)),
       n as (select count(*)::integer c from team),
       k as (select idx from team where author_id = p_author)
  select t.author_id from team t, n, k where t.idx = (k.idx + 1) % n.c;
$$;

-- Renumérote les positions (0..n-1) en gardant l'ordre de passage (cyclique), décalé pour que
-- p_next soit celui dont c'est le tour d'après la rotation. p_next absent de l'équipe : on
-- compacte seulement les positions, sans rien décaler.
create or replace function public.admin_rebalance(p_book uuid, p_next uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_n integer;
  v_e integer;
  v_k integer;
begin
  select count(*) into v_n from public.book_players where book_id = p_book;
  if v_n = 0 then return; end if;
  select count(*) into v_e from public.turns where book_id = p_book and is_ended;
  select idx into v_k from public.admin_team(p_book) where author_id = p_next;
  if v_k is null then v_k := v_e % v_n; end if;
  update public.book_players bp
  set position = (((t.idx - v_k + v_e) % v_n) + v_n) % v_n
  from public.admin_team(p_book) t
  where bp.book_id = p_book and bp.author_id = t.author_id;
end $$;

-- Retire un co-auteur. Son brouillon en cours est supprimé ; si c'était son tour, il passe à
-- celui qui le suivait, sinon l'auteur dont c'est le tour ne change pas.
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
end $$;

-- Ajoute un co-auteur en fin d'ordre de passage, sans changer à qui c'est le tour.
create or replace function public.admin_add_player(p_book uuid, p_author uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_cur uuid;
begin
  if exists (select 1 from public.book_players where book_id = p_book and author_id = p_author) then
    raise exception 'déjà dans l''équipe';
  end if;
  v_cur := public.admin_current_writer(p_book);
  insert into public.book_players (book_id, author_id, position)
  values (p_book, p_author,
          coalesce((select max(position) + 1 from public.book_players where book_id = p_book), 0));
  update public.join_requests set status = 'accepted'
  where book_id = p_book and author_id = p_author and status = 'pending';
  perform public.admin_rebalance(p_book, v_cur);
end $$;

-- Passe le tour de l'auteur actuel au suivant. Son brouillon en cours est supprimé.
-- Renvoie le nouvel auteur dont c'est le tour.
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
  return public.admin_current_writer(p_book);
end $$;

-- Supprime un tour : les tours suivants sont renumérotés (numéros uniques et sans trou) et
-- l'auteur dont c'est le tour reste le même.
create or replace function public.admin_delete_turn(p_turn uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_book uuid;
  v_number integer;
  v_cur uuid;
begin
  select book_id, number into v_book, v_number from public.turns where id = p_turn;
  if v_book is null then raise exception 'tour introuvable'; end if;
  v_cur := public.admin_current_writer(v_book);
  delete from public.turns where id = p_turn;
  -- En deux temps : la contrainte unique (book_id, number) n'est pas différable.
  update public.turns set number = -number where book_id = v_book and number > v_number;
  update public.turns set number = -number - 1 where book_id = v_book and number < 0;
  perform public.admin_rebalance(v_book, v_cur);
end $$;

-- Supprime un auteur en gardant ses tours, anonymisés : il quitte les équipes des livres en
-- cours (règle de admin_remove_player), ses brouillons, demandes, favoris et son profil privé
-- sont effacés, son pseudo devient « Auteur supprimé xxxxxx ». Son compte GoTrue est supprimé
-- par l'app avant cet appel. Il reste dans l'équipe des livres publiés ou archivés.
create or replace function public.admin_delete_author(p_author uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select bp.book_id from public.book_players bp
    join public.books b on b.id = bp.book_id
    where bp.author_id = p_author and b.status = 'launched'
  loop
    perform public.admin_remove_player(r.book_id, p_author);
  end loop;
  delete from public.turns where author_id = p_author and not is_ended;
  delete from public.join_requests where author_id = p_author;
  delete from public.favorites where author_id = p_author;
  delete from public.author_profiles where author_id = p_author;
  update public.authors
  set nickname = 'Auteur supprimé ' || substr(md5(id::text), 1, 6),
      user_id = null,
      deleted_at = coalesce(deleted_at, now())
  where id = p_author;
end $$;

-- Supprime une classe. Ses livres publiés (déjà visibles de tous) sont gardés et deviennent des
-- livres ordinaires ; ses autres livres (en cours, archivés) sont supprimés. Les comptes de
-- connexion des élèves sont supprimés par l'app avant cet appel ; les fiches des élèves qui ont
-- écrit dans un livre gardé restent (prénom sur leurs tours), les autres sont effacées.
create or replace function public.admin_delete_class(p_class uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_students uuid[];
begin
  select coalesce(array_agg(author_id), '{}') into v_students
  from public.class_students where class_id = p_class;
  update public.books set class_id = null, teacher_review = false
  where class_id = p_class and status = 'published';
  delete from public.books where class_id = p_class;
  delete from public.classes where id = p_class;
  delete from public.authors a
  where a.id = any (v_students)
    and not exists (select 1 from public.turns t where t.author_id = a.id);
end $$;

-- 5. Vues des tableaux (tri, filtres et pagination côté serveur via PostgREST).
drop view if exists public.admin_books, public.admin_authors, public.admin_turns, public.admin_classes;

create view public.admin_books as
select
  b.id, b.legacy_code, b.title, b.synopsis, b.status, b.max_players, b.created_at,
  b.launcher_id, la.nickname as launcher_nickname, b.cover_path,
  (select count(*) from public.book_players bp where bp.book_id = b.id)::integer as players_count,
  coalesce(tc.turns_count, 0)::integer as turns_count,
  tc.last_turn_at,
  coalesce(tc.last_turn_at, b.created_at) as last_activity_at,
  cw.author_id as current_writer_id,
  ca.nickname as current_writer_nickname,
  b.class_id, cl.name as class_name, b.teacher_review
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

create view public.admin_authors as
select
  a.id, a.nickname, a.user_id, a.deleted_at, a.kind,
  u.email,
  coalesce(u.created_at, a.created_at) as signed_up_at,
  u.last_sign_in_at,
  p.first_name, p.last_name,
  nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') as full_name,
  p.birth_date, p.city, p.country,
  coalesce(p.is_professional, false) as is_professional,
  coalesce(p.accepts_marketing, false) as accepts_marketing,
  p.admin_note, p.blocked_at,
  (p.blocked_at is not null) as is_blocked,
  lt.last_turn_at,
  coalesce(lt.turns_count, 0)::integer as turns_count,
  (select count(*) from public.book_players bp where bp.author_id = a.id)::integer as books_count,
  exists (select 1 from public.admins ad where ad.user_id = a.user_id) as is_admin
from public.authors a
left join auth.users u on u.id = a.user_id
left join public.author_profiles p on p.author_id = a.id
left join lateral (
  select max(t.created_at) as last_turn_at, count(*) filter (where t.is_ended) as turns_count
  from public.turns t where t.author_id = a.id
) lt on true;

create view public.admin_turns as
select
  t.id, t.book_id, b.legacy_code, b.title as book_title, b.status as book_status,
  t.number, t.author_id, a.nickname as author_nickname, t.created_at, t.is_ended,
  t.content, left(t.content, 160) as excerpt, coalesce(length(t.content), 0) as content_length,
  t.moderation_status, t.moderation_reason, t.moderated_at,
  (t.moderation_status = 'blocked') as is_moderation_blocked
from public.turns t
join public.books b on b.id = t.book_id
left join public.authors a on a.id = t.author_id;

create view public.admin_classes as
select
  c.id, c.name, c.created_at, c.blocked_at, (c.blocked_at is not null) as is_blocked,
  c.owner_id, o.nickname as owner_nickname, u.email as owner_email,
  (p.blocked_at is not null) as owner_blocked,
  (select count(*) from public.class_students s where s.class_id = c.id and s.active)::integer as students_count,
  (select count(*) from public.books b where b.class_id = c.id)::integer as books_count,
  (select count(*) from public.books b where b.class_id = c.id and b.status = 'launched')::integer as launched_count
from public.classes c
join public.authors o on o.id = c.owner_id
left join auth.users u on u.id = o.user_id
left join public.author_profiles p on p.author_id = o.id;

-- Réservé au serveur. Les droits par défaut (0003) donnent la lecture à anon et tout à
-- authenticated sur les nouvelles tables et vues : on les retire.
revoke all on public.admin_books, public.admin_authors, public.admin_turns, public.admin_classes
  from public, anon, authenticated;
grant select on public.admin_books, public.admin_authors, public.admin_turns, public.admin_classes
  to service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'admin_revoke_sessions(uuid)', 'admin_team(uuid)', 'admin_current_writer(uuid)',
    'admin_next_after(uuid, uuid)', 'admin_rebalance(uuid, uuid)', 'admin_remove_player(uuid, uuid)',
    'admin_add_player(uuid, uuid)', 'admin_pass_turn(uuid)', 'admin_delete_turn(uuid)',
    'admin_delete_author(uuid)', 'admin_delete_class(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- PostgREST relit le schéma (nouvelles vues et fonctions).
notify pgrst, 'reload schema';
