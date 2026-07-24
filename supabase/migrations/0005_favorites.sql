-- Favoris : un lecteur peut mettre en favori un livre publié.

create table public.favorites (
  book_id uuid not null references public.books (id) on delete cascade,
  author_id uuid not null references public.authors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, author_id)
);

alter table public.favorites enable row level security;

create policy "lecture publique" on public.favorites for select using (true);

create policy "ajouter un favori" on public.favorites
  for insert to authenticated
  with check (
    author_id in (select id from public.authors where user_id = auth.uid())
  );

create policy "retirer son favori" on public.favorites
  for delete to authenticated
  using (
    author_id in (select id from public.authors where user_id = auth.uid())
  );

-- Les grants par défaut (0003) ne couvrent que les tables créées après leur exécution
-- par le même rôle ; on les pose explicitement par sécurité.
grant select on public.favorites to anon;
grant all on public.favorites to authenticated;
