-- Modération automatique des textes (tours, demandes pour rejoindre, lancement de livre).
-- Rejouable sans risque. Code : src/lib/moderation/.

-- 1. Statut de modération des tours publiés. Mêmes noms et mêmes valeurs que la migration
--    0010_administration (chantier parallèle) : si elle est déjà passée, ces lignes ne font rien.
--      null     = pas contrôlé (tours écrits avant la modération, repris de l'ancien site)
--      'ok'     = lu par l'IA, rien à signaler
--      'review' = publié sans lecture de l'IA (panne ou délai dépassé), en attente de relecture
--      'blocked'= jugé bloquant à la relecture, après publication : à traiter dans l'administration
alter table public.turns add column if not exists moderation_status text;
alter table public.turns add column if not exists moderation_reason text;
alter table public.turns add column if not exists moderated_at timestamptz;
alter table public.turns drop constraint if exists turns_moderation_status_check;
alter table public.turns add constraint turns_moderation_status_check
  check (moderation_status is null or moderation_status in ('ok', 'blocked', 'review'));

-- 2. Journal de la modération : chaque texte bloqué à l'envoi (jamais publié, l'auteur l'a
--    gardé dans son éditeur), et chaque texte publié sans lecture de l'IA, relu ensuite par la
--    tâche /api/cron/moderation. Table réservée au serveur (clé service_role).
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author_id uuid references public.authors (id) on delete set null,
  book_id uuid references public.books (id) on delete set null,
  kind text not null check (kind in ('turn', 'join_request', 'book')),
  -- Texte publié (tour ou demande) quand il existe ; null pour un texte bloqué à l'envoi.
  ref_id uuid,
  content text not null,
  verdict text not null check (verdict in (
    'blocked',        -- bloqué à l'envoi, non publié
    'unverified',     -- publié sans lecture de l'IA, à relire
    'ok_after',       -- relu ensuite : rien à signaler
    'blocked_after'   -- relu ensuite : bloquant, laissé en ligne, à traiter par l'administration
  )),
  category text check (category is null or category in (
    'coordonnees', 'insulte', 'sexuel', 'malsain', 'spam', 'hors_sujet')),
  reason text,
  source text check (source is null or source in ('regex', 'ai')),
  attempts integer not null default 0,
  checked_at timestamptz
);
create index if not exists moderation_log_verdict_idx on public.moderation_log (verdict, created_at);
create index if not exists moderation_log_author_idx on public.moderation_log (author_id, created_at);

alter table public.moderation_log enable row level security;
revoke all on public.moderation_log from anon, authenticated;
grant all on public.moderation_log to service_role;
