-- Policies RLS pour l'auth : chaque utilisateur agit via sa fiche auteur.

-- Créer / modifier sa propre fiche auteur.
create policy "insert sa fiche auteur" on public.authors
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "update sa fiche auteur" on public.authors
  for update to authenticated
  using (user_id = auth.uid());

-- Lancer un livre (launcher = une de ses fiches auteur).
create policy "lancer un livre" on public.books
  for insert to authenticated
  with check (
    launcher_id in (select id from public.authors where user_id = auth.uid())
  );

-- Le lanceur gère son livre (statut, synopsis…).
create policy "update par le lanceur" on public.books
  for update to authenticated
  using (
    launcher_id in (select id from public.authors where user_id = auth.uid())
  );

-- Demander à rejoindre un livre.
create policy "demander a rejoindre" on public.join_requests
  for insert to authenticated
  with check (
    author_id in (select id from public.authors where user_id = auth.uid())
  );

-- Le lanceur du livre accepte/refuse les demandes.
create policy "reponse du lanceur" on public.join_requests
  for update to authenticated
  using (
    book_id in (
      select b.id from public.books b
      join public.authors a on a.id = b.launcher_id
      where a.user_id = auth.uid()
    )
  );

-- Le lanceur compose son équipe (ajout des co-auteurs acceptés).
create policy "equipe par le lanceur" on public.book_players
  for insert to authenticated
  with check (
    book_id in (
      select b.id from public.books b
      join public.authors a on a.id = b.launcher_id
      where a.user_id = auth.uid()
    )
  );

-- Écrire un tour (en son nom uniquement).
create policy "ecrire un tour" on public.turns
  for insert to authenticated
  with check (
    author_id in (select id from public.authors where user_id = auth.uid())
  );

create policy "modifier son tour" on public.turns
  for update to authenticated
  using (
    author_id in (select id from public.authors where user_id = auth.uid())
  );
