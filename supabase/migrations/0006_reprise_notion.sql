-- Reprise de l'ancienne base Notion (scripts/import-notion.py, docs/reprise-notion.md).
-- Rejouable sans risque.

-- Identifiant de la page Notion d'origine : clé stable des reprises (turns.legacy_id existe déjà).
alter table public.authors add column if not exists legacy_id uuid unique;
alter table public.books add column if not exists legacy_id uuid unique;
alter table public.join_requests add column if not exists legacy_id uuid unique;

-- Livres que Juliette a retirés de l'ancien site (statut vidé dans Notion) : conservés, invisibles.
alter table public.books drop constraint if exists books_status_check;
alter table public.books add constraint books_status_check
  check (status in ('launched', 'published', 'archived'));

drop policy if exists "lecture publique" on public.books;
create policy "lecture publique" on public.books for select using (status <> 'archived');

-- Données privées des auteurs (état civil, date de naissance de mineurs, consentement newsletter).
-- Table à part : public.authors est lisible par tout le monde, celle-ci seulement par son auteur.
-- L'e-mail vit dans auth.users.
create table if not exists public.author_profiles (
  author_id uuid primary key references public.authors (id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  school_level text, -- même vocabulaire que books.scolar_level
  city text,
  country text,
  is_professional boolean not null default false, -- enseignant, animateur d'atelier…
  accepts_marketing boolean not null default false, -- consentement newsletter
  admin_note text -- note interne de Co-Aut, jamais montrée à l'auteur
);

alter table public.author_profiles enable row level security;

drop policy if exists "lire son profil" on public.author_profiles;
create policy "lire son profil" on public.author_profiles
  for select to authenticated
  using (author_id in (select id from public.authors where user_id = auth.uid()));

drop policy if exists "creer son profil" on public.author_profiles;
create policy "creer son profil" on public.author_profiles
  for insert to authenticated
  with check (author_id in (select id from public.authors where user_id = auth.uid()));

drop policy if exists "modifier son profil" on public.author_profiles;
create policy "modifier son profil" on public.author_profiles
  for update to authenticated
  using (author_id in (select id from public.authors where user_id = auth.uid()));

-- Les grants par défaut (0003) donnent la lecture à anon : on la retire ici.
-- admin_note n'est accessible à personne par l'API (lecture et écriture par colonnes).
revoke all on public.author_profiles from anon, authenticated;
grant select (author_id, first_name, last_name, birth_date, school_level, city, country, is_professional, accepts_marketing)
  on public.author_profiles to authenticated;
grant insert (author_id, first_name, last_name, birth_date, school_level, city, country, accepts_marketing),
      update (first_name, last_name, birth_date, school_level, city, country, accepts_marketing)
  on public.author_profiles to authenticated;
