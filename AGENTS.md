<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Co-Aut v2

Refonte du MVP [co-aut.com](https://www.co-aut.com) — plateforme d'écriture collaborative de livres (chacun écrit un paragraphe à son tour, pas de messagerie entre auteurs). Objectif : démo meilleure que l'existant pour gagner le devis de la cliente (Juliette Lejeune).

## Stack

Next.js (App Router, TypeScript, Tailwind v4) + Supabase (`.env.local` : URL + clé publishable ; ⚠️ `SERVICE_ROLE_SECRET` contient pour l'instant la clé anon, pas la vraie service_role). Clients Supabase dans `src/lib/supabase/` (browser + server via `@supabase/ssr`).

## Design

Palette reprise du site original : aubergine `#4F2740`, orange `#EC681C`, rouge `#D63E1F`, pêche `#FFBC7D`, noir `#191919` — déclarée dans `src/app/globals.css` (`@theme`). Polices : Roboto Slab (titres, `font-display`) + Open Sans (texte). Assets originaux (logo, illustrations SVG, photos) dans `public/images/`. Piège JSX : un espace en fin de ligne après une balise fermante est supprimé à la compilation → utiliser `{" "}`.

## Données de l'ancien MVP

- `coaut-data/` : captures des routes de l'ancienne API (`app-api.co-aut.com`, JWT Bearer périssable ~18 h), `scrape.py` (rejouable avec un token frais collé dans `route2.txt`), et `scraped/` = **72 livres + 448 tours + 66 auteurs** en JSON.
- `supabase/migrations/0001_schema.sql` : schéma (authors, books, book_players, turns, join_requests ; RLS lecture publique).
- `supabase/migrations/0002_seed.sql` : données réelles (régénérable via `coaut-data/generate_seed_sql.py`).
- `supabase/setup_complete.sql` : schéma + seed concaténés, à exécuter en une fois dans le SQL Editor de Supabase.

Statuts livres : `launched` (recherche co-auteurs / en cours) et `published` (terminé). Un tour avec `is_ended=false` = tour d'écriture en cours. `book_players.position` = ordre de passage.

## Fonctionnement de l'app

`/` = connexion/inscription (le site vitrine reste le WordPress co-aut.com). Routes protégées par `src/proxy.ts` : `/books` (bibliothèque à rejoindre/publiés), `/books/new` (lancer un livre), `/books/mes-livres`, `/books/[code]` (lecture + écriture ; code hérité « 052 » ou uuid pour les nouveaux).

Écriture au tour par tour : la RLS n'autorise à créer un tour que pour soi-même → le tour n'est PAS pré-créé pour le suivant ; « à qui le tour » est calculé par `writingState()` (tour ouvert sinon rotation `positions` : `nb tours terminés % taille équipe`). Publication par le lanceur uniquement, bloquée si un tour d'un autre auteur est ouvert. Demandes à rejoindre : `join_requests` + validation par le lanceur (accept → `book_players`).
