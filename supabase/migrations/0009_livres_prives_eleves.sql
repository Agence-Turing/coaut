-- Livres privés pour les élèves (docs/livres-prives-eleves.md). Rejouable sans risque.
--
-- Un professionnel (author_profiles.is_professional) crée des classes ; chaque élève a un compte
-- technique (e-mail factice non routable, jamais affiché) et une fiche auteur kind = 'student'.
-- Un livre de classe (books.class_id) n'est lisible que par sa classe et son prof tant qu'il n'est
-- pas publié ; un élève ne lit que les livres de sa classe, rien d'autre.

-- 1. Auteurs : adulte ou élève --------------------------------------------------------------
alter table public.authors add column if not exists kind text not null default 'adult';
alter table public.authors drop constraint if exists authors_kind_check;
alter table public.authors add constraint authors_kind_check check (kind in ('adult', 'student'));

-- Les élèves s'affichent sous leur prénom : deux élèves (ou un élève et un adulte) peuvent
-- s'appeler pareil. Le pseudonyme reste unique entre adultes.
alter table public.authors drop constraint if exists authors_nickname_key;
create unique index if not exists authors_nickname_adult_key on public.authors (nickname) where kind = 'adult';

-- Personne ne change son type par l'API : on ne donne que le pseudonyme (et user_id à la création).
revoke insert, update on public.authors from anon, authenticated;
grant insert (nickname, user_id) on public.authors to authenticated;
grant update (nickname) on public.authors to authenticated;

drop policy if exists "update sa fiche auteur" on public.authors;
create policy "update sa fiche auteur" on public.authors
  for update to authenticated
  using (user_id = auth.uid() and kind = 'adult');

-- 2. Profil professionnel (case dans « Mon profil », sans validation) ----------------------
alter table public.author_profiles add column if not exists organization text;
grant select (organization) on public.author_profiles to authenticated;
grant insert (is_professional, organization), update (is_professional, organization)
  on public.author_profiles to authenticated;

-- 3. Classes et élèves -------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.authors (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists classes_owner_idx on public.classes (owner_id);

-- code = affiché au prof (« LOUTRE-2510 ») ; code_key = forme normalisée (« LOUTRE2510 »),
-- unique parmi les élèves actifs, nulle pour un élève retiré. Jamais écrit par l'API :
-- les codes sont tirés côté serveur (sinon un prof pourrait sonder les codes des autres classes).
create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  author_id uuid not null unique references public.authors (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 40),
  position integer not null default 0,
  code text,
  code_key text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists class_students_code_key on public.class_students (code_key) where code_key is not null;
create index if not exists class_students_class_idx on public.class_students (class_id);

-- Tentatives de connexion par code (limite par adresse IP, hachée). Serveur uniquement.
create table if not exists public.class_login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists class_login_attempts_idx on public.class_login_attempts (created_at, ip_hash);

-- 4. Livres de classe ----------------------------------------------------------------------
alter table public.books add column if not exists class_id uuid references public.classes (id) on delete restrict;
-- Relecture de chaque tour par le prof avant qu'il soit ajouté au livre.
alter table public.books add column if not exists teacher_review boolean not null default false;
create index if not exists books_class_idx on public.books (class_id) where class_id is not null;
create index if not exists turns_author_idx on public.turns (author_id);

-- 5. Fonctions d'aide aux policies (security definer : pas de récursion RLS) ---------------
create or replace function public.is_student()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.authors where user_id = auth.uid() and kind = 'student');
$$;

-- Classe de l'élève connecté (null s'il n'est pas élève ou s'il a été retiré).
create or replace function public.my_student_class()
returns uuid language sql stable security definer set search_path = public as $$
  select cs.class_id from public.class_students cs
  join public.authors a on a.id = cs.author_id
  where a.user_id = auth.uid() and a.kind = 'student' and cs.active
  limit 1;
$$;

-- La classe appartient-elle au prof connecté ?
create or replace function public.owns_class(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classes c join public.authors a on a.id = c.owner_id
    where c.id = cid and a.user_id = auth.uid()
  );
$$;

-- L'auteur connecté est-il un professionnel (adulte, case cochée) ?
create or replace function public.is_professional()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.authors a join public.author_profiles p on p.author_id = a.id
    where a.user_id = auth.uid() and a.kind = 'adult' and p.is_professional
  );
$$;

-- Fiche auteur du connecté (évite de relire authors, et donc sa RLS, dans les policies).
create or replace function public.my_author_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.authors where user_id = auth.uid();
$$;

-- Le prénom d'un élève est-il visible du connecté ? Oui pour son prof et ses camarades de classe,
-- et pour tout le monde s'il a écrit dans un livre publié.
create or replace function public.can_see_student(aid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_students cs
    where cs.author_id = aid
      and (public.owns_class(cs.class_id) or cs.class_id = public.my_student_class())
  ) or exists (
    select 1 from public.book_players p join public.books b on b.id = p.book_id
    where p.author_id = aid and b.status = 'published'
  ) or exists (
    select 1 from public.turns t join public.books b on b.id = t.book_id
    where t.author_id = aid and b.status = 'published'
  );
$$;

revoke all on function public.is_student(), public.my_student_class(), public.owns_class(uuid), public.is_professional(),
  public.my_author_id(), public.can_see_student(uuid) from public, anon;
grant execute on function public.is_student(), public.my_student_class(), public.owns_class(uuid), public.is_professional(),
  public.my_author_id(), public.can_see_student(uuid) to anon, authenticated;

-- 6. RLS des classes -----------------------------------------------------------------------
alter table public.classes enable row level security;
alter table public.class_students enable row level security;
alter table public.class_login_attempts enable row level security;

revoke all on public.classes, public.class_students, public.class_login_attempts from anon, authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select on public.class_students to authenticated;
grant all on public.classes, public.class_students, public.class_login_attempts to service_role;

drop policy if exists "lire ses classes" on public.classes;
create policy "lire ses classes" on public.classes
  for select to authenticated
  using (owner_id = (select public.my_author_id()) or id = (select public.my_student_class()));

drop policy if exists "creer une classe" on public.classes;
create policy "creer une classe" on public.classes
  for insert to authenticated
  with check (
    (select public.is_professional())
    and owner_id = (select public.my_author_id())
  );

drop policy if exists "modifier sa classe" on public.classes;
create policy "modifier sa classe" on public.classes
  for update to authenticated
  using (owner_id = (select public.my_author_id()))
  with check (owner_id = (select public.my_author_id()));

drop policy if exists "supprimer sa classe" on public.classes;
create policy "supprimer sa classe" on public.classes
  for delete to authenticated
  using (owner_id = (select public.my_author_id()));

drop policy if exists "lire les eleves" on public.class_students;
create policy "lire les eleves" on public.class_students
  for select to authenticated
  using (
    public.owns_class(class_id)
    or author_id = (select public.my_author_id())
  );

-- 7. Livres : qui lit quoi -----------------------------------------------------------------
-- Élève : les livres de sa classe, rien d'autre. Les autres : livres publics, livres publiés,
-- et les livres de leurs propres classes.
drop policy if exists "lecture publique" on public.books;
create policy "lecture publique" on public.books
  for select
  using (
    status <> 'archived'
    and case
      when (select public.is_student()) then class_id is not null and class_id = (select public.my_student_class())
      else class_id is null or status = 'published' or public.owns_class(class_id)
    end
  );

-- Un élève ne lance pas de livre ; un livre de classe se lance pour une de ses classes.
drop policy if exists "lancer un livre" on public.books;
create policy "lancer un livre" on public.books
  for insert to authenticated
  with check (
    launcher_id = (select public.my_author_id()) and not (select public.is_student())
    and (class_id is null or public.owns_class(class_id))
  );

drop policy if exists "update par le lanceur" on public.books;
create policy "update par le lanceur" on public.books
  for update to authenticated
  using (launcher_id = (select public.my_author_id()))
  with check (
    launcher_id = (select public.my_author_id())
    and (class_id is null or public.owns_class(class_id))
  );

-- Équipes et tours : visibles si le livre l'est (la RLS de books s'applique dans la sous-requête).
drop policy if exists "lecture publique" on public.book_players;
create policy "lecture publique" on public.book_players
  for select using (exists (select 1 from public.books b where b.id = book_id));

drop policy if exists "lecture publique" on public.turns;
create policy "lecture publique" on public.turns
  for select using (exists (select 1 from public.books b where b.id = book_id));

-- Élèves : leur prénom n'est visible que là où ils écrivent (livres lisibles par celui qui regarde).
drop policy if exists "lecture publique" on public.authors;
create policy "lecture publique" on public.authors
  for select
  using (kind = 'adult' or user_id = auth.uid() or public.can_see_student(id));

-- Équipe d'un livre de classe : uniquement des élèves de cette classe (encore actifs).
drop policy if exists "equipe par le lanceur" on public.book_players;
create policy "equipe par le lanceur" on public.book_players
  for insert to authenticated
  with check (
    book_id in (
      select b.id from public.books b
      where b.launcher_id = (select public.my_author_id())
        and (
          b.class_id is null
          or author_id in (select cs.author_id from public.class_students cs where cs.class_id = b.class_id and cs.active)
        )
    )
  );

-- Ordre de passage (livres de classe) et retrait d'un élève de l'équipe : par le lanceur.
drop policy if exists "ordre par le lanceur" on public.book_players;
create policy "ordre par le lanceur" on public.book_players
  for update to authenticated
  using (
    book_id in (
      select b.id from public.books b
      where b.launcher_id = (select public.my_author_id()) and b.class_id is not null
    )
  );

drop policy if exists "retrait par le lanceur" on public.book_players;
create policy "retrait par le lanceur" on public.book_players
  for delete to authenticated
  using (
    book_id in (
      select b.id from public.books b
      where b.launcher_id = (select public.my_author_id()) and b.class_id is not null
    )
  );

-- Tours d'un livre de classe : seuls les membres de l'équipe écrivent, livre en cours.
drop policy if exists "livre de classe : equipe seulement" on public.turns;
create policy "livre de classe : equipe seulement" on public.turns
  as restrictive
  for insert to authenticated
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (
          b.class_id is null
          or (b.status = 'launched'
              and exists (select 1 from public.book_players p where p.book_id = b.id and p.author_id = turns.author_id))
        )
    )
  );

-- Un élève n'écrit que dans les livres de sa classe (même s'il trouvait l'id d'un autre livre).
drop policy if exists "eleve : sa classe seulement" on public.turns;
create policy "eleve : sa classe seulement" on public.turns
  as restrictive
  for all to authenticated
  using (not (select public.is_student()) or book_id in (select id from public.books where class_id = (select public.my_student_class()) and status = 'launched'))
  with check (not (select public.is_student()) or book_id in (select id from public.books where class_id = (select public.my_student_class()) and status = 'launched'));

-- Le prof passe le tour d'un absent (tour vide, clos) et relit les tours de ses livres de classe.
drop policy if exists "passer un tour (prof)" on public.turns;
create policy "passer un tour (prof)" on public.turns
  for insert to authenticated
  with check (
    content is null and is_ended
    and book_id in (
      select b.id from public.books b
      where b.launcher_id = (select public.my_author_id()) and b.class_id is not null and b.status = 'launched'
    )
  );

drop policy if exists "relecture par le prof" on public.turns;
create policy "relecture par le prof" on public.turns
  for update to authenticated
  using (
    book_id in (
      select b.id from public.books b
      where b.launcher_id = (select public.my_author_id()) and b.class_id is not null and b.status = 'launched'
    )
  );

-- Pas de demande à rejoindre pour un livre de classe, ni de la part d'un élève.
drop policy if exists "demander a rejoindre" on public.join_requests;
create policy "demander a rejoindre" on public.join_requests
  for insert to authenticated
  with check (
    author_id = (select public.my_author_id()) and not (select public.is_student())
    and book_id in (select id from public.books where class_id is null)
  );

-- 8. Mails : récapitulatif quotidien au prof -----------------------------------------------
alter table public.mail_log drop constraint if exists mail_log_kind_check;
alter table public.mail_log add constraint mail_log_kind_check check (kind in (
  'your_turn', 'turn_reminder_1', 'turn_reminder_2',
  'join_request', 'join_accepted', 'join_rejected', 'book_published',
  'class_digest'));
