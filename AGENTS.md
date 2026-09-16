<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Co-Aut v2

Refonte du MVP [co-aut.com](https://www.co-aut.com) — plateforme d'écriture collaborative de livres (chacun écrit un paragraphe à son tour, pas de messagerie entre auteurs). Objectif : démo meilleure que l'existant pour gagner le devis de la cliente (Juliette Lejeune).

## Stack

Next.js (App Router, TypeScript, Tailwind v4) + Supabase (`.env` : URL + clé publishable/anon ; en prod la clé anon est un JWT HS256 de la stack auto-hébergée). Clients Supabase dans `src/lib/supabase/` (browser + server via `@supabase/ssr`).

## Design

Palette reprise du site original : aubergine `#4F2740`, orange `#EC681C`, rouge `#D63E1F`, pêche `#FFBC7D`, noir `#191919` — déclarée dans `src/app/globals.css` (`@theme`). Polices : Roboto Slab (titres, `font-display`) + Open Sans (texte). Assets originaux (logo, illustrations SVG, photos) dans `public/images/`. Piège JSX : un espace en fin de ligne après une balise fermante est supprimé à la compilation → utiliser `{" "}`.

## Données de l'ancien MVP

- `coaut-data/` : captures des routes de l'ancienne API (`app-api.co-aut.com`, JWT Bearer périssable ~18 h), `scrape.py` (rejouable avec un token frais collé dans `route2.txt`), et `scraped/` = **72 livres + 448 tours + 66 auteurs** en JSON.
- `supabase/migrations/0001_schema.sql` : schéma (authors, books, book_players, turns, join_requests ; RLS lecture publique).
- `supabase/migrations/0002_seed.sql` : données réelles (régénérable via `coaut-data/generate_seed_sql.py`).
- `supabase/setup_complete.sql` : schéma + seed concaténés, à exécuter en une fois dans le SQL Editor de Supabase.

Statuts livres : `launched` (recherche co-auteurs / en cours) et `published` (terminé). Un tour avec `is_ended=false` = tour d'écriture en cours. `book_players.position` = ordre de passage.

## Déploiement (dédié agence, depuis le 2026-09-16)

Plus de Vercel ni de Supabase cloud. Le site tourne sur le dédié dans `/opt/coaut` : `docker-compose.yml` = cette app (image buildée depuis `Dockerfile`, Next standalone) + stack Supabase dédiée (Postgres, GoTrue, PostgREST, Kong) interne au réseau Docker — `NEXT_PUBLIC_SUPABASE_URL=http://kong:8000`, figée au build. Public via Traefik : https://coaut.agence-turing.com. Redéployer : `cd /opt/coaut && sudo git -C app pull && sudo docker compose build app && sudo docker compose up -d app`. Migrations SQL : à passer à la main dans `coaut-db` (`docker exec -i coaut-db psql -U postgres < fichier.sql`). Détail côté agence : `technique/infra/dedie-turing.md` du repo turing-os.

## Fonctionnement de l'app

`/` = connexion/inscription (le site vitrine reste le WordPress co-aut.com). Routes protégées par `src/proxy.ts` : `/books` (bibliothèque à rejoindre/publiés), `/books/new` (lancer un livre), `/books/mes-livres`, `/books/[code]` (lecture + écriture ; code hérité « 052 » ou uuid pour les nouveaux).

Écriture au tour par tour : la RLS n'autorise à créer un tour que pour soi-même → le tour n'est PAS pré-créé pour le suivant ; « à qui le tour » est calculé par `writingState()` (tour ouvert sinon rotation `positions` : `nb tours terminés % taille équipe`). Publication par le lanceur uniquement, bloquée si un tour d'un autre auteur est ouvert. Demandes à rejoindre : `join_requests` + validation par le lanceur (accept → `book_players`).
