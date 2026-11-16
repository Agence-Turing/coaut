-- Couverture illustrée d'un livre. Rejouable sans risque.
-- cover_path = nom de fichier seul (ex. « 052-3fa9c1d2.webp »), servi par l'app à /couvertures/<cover_path>
-- depuis un dossier monté dans le conteneur. NULL = pas de couverture, l'interface a son repli.
alter table public.books add column if not exists cover_path text;

-- Jamais de chemin : uniquement un nom de fichier image simple (le lanceur a le droit de modifier son livre).
alter table public.books drop constraint if exists books_cover_path_format;
alter table public.books add constraint books_cover_path_format
  check (cover_path is null or cover_path ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,80}\.webp$');
