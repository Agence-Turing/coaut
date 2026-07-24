-- Co-Aut v2 — schéma initial
-- Modélisation propre du MVP existant : livres écrits à plusieurs, chacun son tour.

create extension if not exists "pgcrypto";

-- Les auteurs du MVP n'existent que par leur pseudonyme.
-- user_id fera le lien avec auth.users quand l'auth sera en place.
create table public.authors (
  id uuid primary key default gen_random_uuid(),
  nickname text not null unique,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  legacy_code text unique, -- code "#052" de l'ancien MVP
  title text not null,
  synopsis text,
  themes text[] not null default '{}',
  scolar_level text, -- niveau scolaire libre : CM1, 6eme, Adulte…
  status text not null default 'launched' check (status in ('launched', 'published')),
  launcher_id uuid references public.authors (id) on delete set null,
  max_players integer, -- nombre de co-auteurs souhaité (absent de l'ancien MVP)
  cover_url text,
  file_url text,
  created_at timestamptz not null default now()
);

-- Équipe d'un livre ; position = ordre de passage pour l'écriture au tour par tour.
create table public.book_players (
  book_id uuid not null references public.books (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  position integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (book_id, author_id)
);

-- Un tour = un passage d'écriture d'un auteur. is_ended=false = tour en cours.
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  legacy_id uuid unique,
  book_id uuid not null references public.books (id) on delete cascade,
  number integer not null,
  author_id uuid references public.authors (id) on delete set null,
  content text,
  is_ended boolean not null default false,
  is_validated boolean not null default false,
  created_at timestamptz not null default now(),
  unique (book_id, number)
);
create index turns_book_id_idx on public.turns (book_id);

-- Demandes pour rejoindre l'écriture d'un livre.
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (book_id, author_id)
);

-- RLS : lecture publique pour tout le monde ; l'écriture passera par l'auth.
alter table public.authors enable row level security;
alter table public.books enable row level security;
alter table public.book_players enable row level security;
alter table public.turns enable row level security;
alter table public.join_requests enable row level security;

create policy "lecture publique" on public.authors for select using (true);
create policy "lecture publique" on public.books for select using (true);
create policy "lecture publique" on public.book_players for select using (true);
create policy "lecture publique" on public.turns for select using (true);
create policy "lecture publique" on public.join_requests for select using (true);
