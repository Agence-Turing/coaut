<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Co-Aut v2

Refonte du MVP [co-aut.com](https://www.co-aut.com) — plateforme d'écriture collaborative de livres (chacun écrit un paragraphe à son tour, pas de messagerie entre auteurs). Objectif : démo meilleure que l'existant pour gagner le devis de la cliente (Juliette Lejeune).

## Stack

Next.js (App Router, TypeScript, Tailwind v4) + Supabase (`.env` : URL + clé publishable/anon ; en prod la clé anon est un JWT HS256 de la stack auto-hébergée). Clients Supabase dans `src/lib/supabase/` (browser + server via `@supabase/ssr`).

## Design

Direction « Carnet » (validée par Toni le 2026-11-16) : fond blanc, le texte d'abord, et pour seules couleurs celles du logo.

- **Jetons** dans `src/app/globals.css` (`@theme`), jamais de couleur en dur dans un composant : `paper`, `ink` `#1C1917`, `muted` `#57524D`, `subtle` `#6B6661`, `line` `#E8E6E3`, `line-strong` `#CFCBC6`, `surface` `#F3F1EE`, `brand` `#FF8A1E`, `accent` `#E0421C`, `accent-deep`, teintes `tint-orange` `#FFD9B0`, `tint-rose` `#FFE1D6`, `tint-cream` `#FFF3E6`, liens `link` `#B03A12`.
- **Orange** : boutons principaux uniquement, toujours avec du texte encre. Jamais de texte blanc sur orange ni de texte orange sur blanc (contraste insuffisant) ; les liens sont en `link`.
- **Polices** (`next/font`) : Zilla Slab (`font-display` : titres et texte des histoires) et Inter (`font-sans` : interface).
- **Logo** : `src/components/Logo.tsx` = le rond du logo (`public/images/logo-mark.png`) + « Co-Aut » retapé, car le fichier d'origine a « Co » en blanc. `logo-co-aut.png` ne sert plus que sur fond sombre (bandeau des mails).
- **Briques** dans `src/components/ui.tsx` : `BTN_PRIMARY` / `BTN_SECONDARY` / `BTN_DARK`, `INPUT`, `LABEL`, `LINK`, `EYEBROW`, `Notice` (retour d'action), `PageHeading`, `Cta`.
- **Livres** : listes en « fiches en largeur » (`BookCard` dans `BookShelf`, une par ligne sur téléphone, deux sur ordinateur) : petite couverture colorée à gauche (`BookCover` : aplat tiré du code du livre, tranche foncée, titre), à droite thème, titre (+ tome et dates via `splitTitle`), début du résumé coupé sur 3-4 lignes, repères et pastilles. Toute la fiche est cliquable. Mêmes fiches sur `/books`, `/bibliotheque`, `/books/mes-livres` et les pages de classe.
- **Page d'un livre** : « fil des tours » (pastilles numérotées reliées, auteur et date), premiers tours repliés au-delà de 5 pour un livre en cours, tour à écrire en orange avec trois coups de pouce (phrases d'aide fixes, sans IA), puis « Ensuite : X ».
- **Règles** : sobre, pas de mise en page « titre à gauche, texte à droite », pas de dégradé décoratif, pas d'émoji, tutoiement, phrases courtes ; rien d'affiché qui ne soit vrai en base ; tout tient à 360 px, cibles tactiles de 44 px, focus visible.
- Piège JSX : un espace en fin de ligne après une balise fermante est supprimé à la compilation → utiliser `{" "}`.

## Données de l'ancien MVP

- `coaut-data/` : captures des routes de l'ancienne API (`app-api.co-aut.com`, JWT Bearer périssable ~18 h), `scrape.py` (rejouable avec un token frais collé dans `route2.txt`), et `scraped/` = **72 livres + 448 tours + 66 auteurs** en JSON.
- `supabase/migrations/0001_schema.sql` : schéma (authors, books, book_players, turns, join_requests ; RLS lecture publique).
- `supabase/migrations/0002_seed.sql` : données réelles (régénérable via `coaut-data/generate_seed_sql.py`).
- `supabase/setup_complete.sql` : schéma + seed concaténés, à exécuter en une fois dans le SQL Editor de Supabase.

- **Reprise de la base Notion de l'ancien site** (source complète : joueurs, livres, tours, demandes) : `scripts/import-notion.py` + migration `0006_reprise_notion.sql`, mode d'emploi dans `docs/reprise-notion.md`. L'export Notion ne se commite jamais (données personnelles).

Statuts livres : `archived` (retiré par Juliette, invisible), `launched` (recherche co-auteurs / en cours) et `published` (terminé). Un tour avec `is_ended=false` = tour d'écriture en cours. `book_players.position` = ordre de passage.

## Déploiement (VM agents du dédié agence)

Plus de Vercel ni de Supabase cloud. Depuis le 2026-09-30 la pile tourne dans la VM agents (`ssh -J ubuntu@54.38.69.101 turing@192.168.200.10`), dans `/opt/coaut` : `docker-compose.yml` = cette app (image buildée depuis `Dockerfile`, Next standalone) + stack Supabase dédiée (Postgres, GoTrue, PostgREST, Kong) interne au réseau Docker — `NEXT_PUBLIC_SUPABASE_URL=http://kong:8000`, figée au build. Public via Traefik : https://coaut.agence-turing.com. Redéployer (en `turing`, sans `sudo` : root n'a pas d'accès GitHub, le clone appartient à `turing` dont la clé lit le repo ; verrou car plusieurs agents déploient) : `cd /opt/coaut && flock .deploy.lock sh -c 'git -C app pull --ff-only && docker compose build app && docker compose up -d app'`. Avant un déploiement risqué : `docker tag coaut-app:latest coaut-app:avant-<sujet>` pour pouvoir revenir en arrière. Migrations SQL : à passer à la main dans `coaut-db` (`docker exec -i coaut-db psql -U postgres < fichier.sql`). Détail côté agence : `technique/infra/dedie-turing.md` du repo turing-os.

**Mails de la préprod** : le SMTP de GoTrue pointe sur un Mailpit interne à la pile (`coaut-mailpit`, service `mailpit` du compose de `/opt/coaut`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025` dans son `.env`), sans relais sortant ; le SMTP sortant de la VM est de toute façon bloqué au pare-feu. La base contient les vraies adresses des auteurs repris de Notion : ne jamais brancher un service d'envoi sur la préprod. Lire les mails : `ssh -L 8226:127.0.0.1:8226 -J ubuntu@54.38.69.101 turing@192.168.200.10` puis http://localhost:8226 (boucle locale de la VM, rien de public). Sauvegardes avant opération : `/opt/coaut/backups/`.

Mise en ligne en une commande depuis un poste qui a l'accès SSH : `scripts/deploy-preprod.sh` (pull dans la VM, build, redémarrage sous verrou, l'image d'avant reste sous `coaut-app:precedente`).

## Mails

Deux sources, un seul gabarit (bandeau aubergine, bouton orange, tutoiement) :

- **Compte (GoTrue)** : mot de passe oublié et confirmation d'adresse. Modèles dans `public/emails/recovery.html` et `confirmation.html`, que GoTrue lit sur le réseau Docker (`MAILER_TEMPLATES_*=http://app:3000/emails/…`, sujets `MAILER_SUBJECTS_*`, dans `/opt/coaut/.env`). GoTrue n'étant pas exposé au public, les liens pointent sur l'app : `/auth/confirm?token_hash=…&type=recovery|email`, qui vérifie le jeton côté serveur puis ouvre la session. Confirmation d'adresse activée (`ENABLE_EMAIL_AUTOCONFIRM=false`). La fiche auteur est créée par le trigger `handle_new_user` dès l'inscription : le pseudonyme est réservé avant la confirmation.
- **App (`src/lib/mail/`)** : `notify.ts` (déclencheurs), `templates.ts` (textes), `send.ts` (envoi SMTP + journal), `config.ts` (délais des relances). Appelés depuis `src/app/books/actions.ts` avec `after()` : un mail raté ne bloque jamais l'action. Mails : à toi d'écrire (tour précédent terminé, ou premier co-auteur accepté sur un livre vide), relances à 4 et 8 jours, demande reçue (au lanceur), demande acceptée ou refusée (au demandeur), livre publié (à l'équipe sauf celui qui publie). L'adresse est lue dans `auth.users` avec la clé service (`src/lib/supabase/admin.ts`) au moment de l'envoi et ne sort jamais du serveur.
- **Journal `mail_log`** (migration 0007) : une ligne par mail, unique par (type, auteur, clé), donc jamais de doublon ; table invisible par l'API publique. Les relances partent uniquement des lignes « à toi d'écrire » déjà envoyées : les tours ouverts repris de l'ancien site, pour lesquels aucun mail n'est parti, ne sont jamais relancés.
- **Relances** : `GET /api/cron/relances` avec `Authorization: Bearer $CRON_SECRET`. En préprod : `/opt/coaut/cron-relances.sh`, crontab de `turing`, toutes les heures de 9 h à 19 h (heure de Paris), journal `/opt/coaut/cron-relances.log`.
- **Variables de l'app** (`/opt/coaut/app/.env`) : `SITE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE=1` (TLS implicite), `MAIL_FROM`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_SECRET`. Sans `SMTP_HOST`, rien ne part (ligne `skipped` dans le journal). En production : brancher le fournisseur SMTP retenu sur l'app et sur GoTrue, et déclarer le domaine d'envoi (SPF, DKIM).

## Fonctionnement de l'app

`/` = connexion/inscription (le site vitrine reste le WordPress co-aut.com). Routes protégées par `src/proxy.ts` : `/books` (bibliothèque à rejoindre/publiés), `/books/new` (lancer un livre), `/books/mes-livres`, `/books/[code]` (lecture + écriture ; code hérité « 052 » ou uuid pour les nouveaux).

Écriture au tour par tour : la RLS n'autorise à créer un tour que pour soi-même → le tour n'est PAS pré-créé pour le suivant ; « à qui le tour » est calculé par `writingState()` (tour ouvert sinon rotation `positions` : `nb tours terminés % taille équipe`). Publication par le lanceur uniquement, bloquée si un tour d'un autre auteur est ouvert. Demandes à rejoindre : `join_requests` + validation par le lanceur (accept → `book_players`).

Profil : `/profil` (protégé). La date de naissance vit dans `author_profiles.birth_date` (table privée, lisible par son seul auteur), l'âge est toujours calculé (`ageFrom` dans `src/lib/profile.ts`), jamais stocké ni montré aux autres. À l'inscription elle passe par les métadonnées du compte (`birth_date`) et `getCurrentUser()` la recopie dans le profil dès que la fiche auteur existe. Le niveau scolaire (`school_level`) repris de Notion n'est plus demandé.

## Classes et élèves (livres privés)

Spécification : `docs/livres-prives-eleves.md`. Migration `0009_livres_prives_eleves.sql`, tests RLS rejouables dans `supabase/tests/0009_livres_prives_rls.sql`.

- **Prof** : case « enseignant ou professionnel » dans `/profil` (`author_profiles.is_professional` + `organization`, sans validation) → menu « Mes classes » (`/classes`, `/classes/[id]`, planche d'étiquettes `/classes/[id]/etiquettes`). Actions dans `src/app/classes/actions.ts`, outils dans `src/lib/classes.ts`.
- **Élève** : compte technique créé par la clé service (`eleve-<uuid>@eleves.co-aut.invalid`, adresse déjà confirmée donc GoTrue n'envoie rien, `app_metadata.coaut_kind = "student"`), fiche `authors.kind = 'student'` au prénom (le pseudonyme n'est unique qu'entre adultes), ligne `class_students` avec son code (`MOT-1234` ; `code_key` normalisé, unique, écrit uniquement côté serveur). Connexion sur `/classe` : le code est cherché avec la clé service, puis un lien magique est généré et vérifié côté serveur (`src/app/classe/actions.ts`) ; 30 échecs par IP et 300 au total par 10 minutes (`class_login_attempts`). Code valable tant que la classe a un livre en cours ou aucun livre. Le proxy renvoie l'élève vers `/classe/livres` depuis les pages d'adultes.
- **Livre de classe** : `books.class_id` (null = public), `books.teacher_review` (relecture : le tour terminé reste `is_validated = false` et bloque la rotation jusqu'à « Valider » ou « Rendre à l'élève »). Lanceur = le prof, hors équipe ; équipe = les élèves actifs. Panneau du prof sur la page du livre (`ClassBookPanel`) : relecture, passer le tour d'un absent (tour vide clos), ordre de passage. Jamais dans « Rejoindre un livre » ; publié, il rejoint la bibliothèque.
- **RLS** : un élève ne lit que les livres de sa classe ; un livre de classe non publié n'est lisible que par sa classe et son prof ; `turns`, `book_players` et le prénom des élèves suivent la visibilité du livre. Fonctions `security definer` (`is_student`, `my_student_class`, `owns_class`, `my_author_id`…) pour éviter la récursion entre policies. Piège : une policy de lecture qui passe par une fonction `stable` ne voit pas la ligne qu'on vient d'insérer (`insert … returning`) ; comparer la colonne directement.
- **Mails** : `sendToAuthor` ne part jamais vers un élève (ligne `skipped` « élève »). Récap quotidien du prof (`src/lib/mail/class-digest.ts`, type `class_digest`) envoyé par la tâche des relances à partir de 18 h, un par prof et par jour, seulement s'il y a eu un tour écrit ou une relecture en attente ; `?recap=maintenant` le force pour un essai.

## Modération

Tout texte saisi par un auteur et visible par d'autres passe par `checkText()` (`src/lib/moderation/index.ts`) avant d'être enregistré : tour terminé (et brouillon du lanceur publié avec le livre), message d'une demande pour rejoindre, titre + thèmes + résumé d'un livre lancé. Le pseudonyme, à l'inscription, ne passe que le repérage par le code. Les brouillons ne sont pas vérifiés (montrés à personne). La correction des fautes des tours passe dans le même appel (voir « Correction »).

- **Étage 1, code** (`contacts.ts`, tests `contacts.test.ts`, `npm test`) : liens, e-mails, téléphones FR et internationaux, numéro dicté en lettres, réseau suivi d'un identifiant, `@pseudo`. Bloque tout de suite.
- **Étage 2, Claude Haiku** (`ai.ts`, modèle `claude-haiku-5-5`, sortie JSON verdict + catégorie + raison, sans réflexion, 300 jetons de sortie max, 5 s max, sans nouvel essai) : coordonnées déguisées, insulte à une vraie personne, sexuel, malsain, spam, hors sujet. Fiction : violence et insultes entre personnages permises. Coût mesuré : ~1 600 jetons en entrée, ~0,0002 $ par texte. Jeu d'essai contre l'IA réelle : `ANTHROPIC_API_KEY=… npm run essai-moderation`.
- **Bloqué** : rien n'est enregistré, l'auteur voit un message selon la catégorie (`messages.ts`), son texte reste dans le champ (champs contrôlés : React vide les formulaires après une action). Ligne `blocked` dans `moderation_log` (migration 0011, table réservée au serveur : auteur, livre, type, texte, catégorie, raison, source `regex`/`ai`).
- **IA en panne ou trop lente** : le texte passe après le seul repérage par le code, tour en `moderation_status = 'review'`, ligne `unverified` dans le journal. `GET /api/cron/moderation` (Bearer `CRON_SECRET`) le relit : `ok_after` (tour `ok`) ou `blocked_after` (tour `blocked` + `moderation_reason`). Un texte jugé bloquant après coup **reste en ligne** : il est déjà lu et le retirer casserait le fil ; l'administration tranche. En préprod : `/opt/coaut/cron-moderation.sh`, crontab de `turing`, toutes les 15 min, journal `/opt/coaut/cron-moderation.log`.
- `turns.moderation_status` : null = pas contrôlé (tours d'avant), `ok`, `review`, `blocked` — mêmes noms que la migration 0010 de l'administration.
- **Clé** : `ANTHROPIC_API_KEY` dans `/opt/coaut/app/.env`. En préprod c'est la clé de l'agence (coffre Bitwarden « Turing — Claude API ») ; **en production il faudra une clé au nom de Co-Aut**. Sans clé, tout passe en `review`.
- Limite connue : la RLS laisse un auteur écrire ses tours directement par l'API Supabase, sans passer par l'action serveur ni la modération.

## Correction

Fautes d'orthographe et de grammaire des tours, **sans jamais réécrire le texte** (beaucoup d'auteurs sont des enfants : tournures, répétitions et style restent). Code dans `src/lib/correction/`, lancé par `checkText()` (option `correction`) en parallèle de la modération : un seul temps d'attente à « Terminer mon tour ».

- **IA** (`ia.ts`, `claude-haiku-5-5`, réflexion adaptative, effort `low`, sortie JSON, 8 s max, sans nouvel essai) : ne renvoie jamais le texte, seulement des propositions `extrait` (3-6 mots copiés pour situer) / `fautif` (1-2 mots) / `correction` / `type` (orthographe, accord, conjugaison, homophone, ponctuation, majuscule). Reçoit les noms propres du livre. Sans réponse à temps ou sans clé : envoi direct, sans correction. Coût mesuré : ~1 500 jetons en entrée, ~400 en sortie, ~0,0004 $ par tour ; médiane 2,5 s, textes très fautifs 5-8 s.
- **Filtre** (`filtre.ts`, pur, tests `filtre.test.ts`, `npm test`) : rejette plus de deux mots, ajout ou suppression de mot, mot remplacé par un autre mot (acceptés seulement : mêmes lettres aux accents/majuscules/apostrophes près, même clé phonétique française simplifiée, même racine + terminaison d'accord ou de conjugaison, mots-outils de la même famille le/la/les, faute de frappe d'une lettre dès 5 lettres ou de deux dès 8), passage introuvable ou ambigu, chiffres, onomatopées (lettre triplée), mot à majuscule hors début de phrase (nom propre), faute d'« orthographe » sur un mot déjà écrit ailleurs dans le livre. Le texte corrigé est reconstruit par le code et vérifié (`verifierReconstruction`).
- **Interface** (`CorrectionsRevue.tsx`, dans `TurnEditor`) : s'il y a des corrections, l'auteur voit son texte avec les mots corrigés surlignés (ancien barré, nouveau en gras, boutons de 44 px), touche un mot pour garder sa version, puis « Envoyer » (corrections acceptées par défaut) ou « Revenir à mon texte ». Aucune correction : envoi direct.
- **Un seul passage** : la relecture renvoie un jeton signé (`jeton.ts`, HMAC avec `CORRECTION_SECRET`, sinon `SUPABASE_SERVICE_ROLE_SECRET` ou `CRON_SECRET`) qui porte le texte vérifié, ses corrections et le verdict de la modération ; à l'envoi, si le texte reçu n'en diffère que par ces corrections, la modération n'est pas refaite. Sinon (jeton absent, expiré, texte modifié) elle repasse.
- Jeu d'essai contre l'IA réelle (11 pièges : homophones, participes, noms inventés, onomatopées, langage parlé, texte sans faute) : `ANTHROPIC_API_KEY=… npm run essai-correction`.

## Administration

Spécification : `docs/administration.md`. Migration `0010_administration.sql` (après 0009). `/admin` : Livres, Auteurs, Tours, Classes, chacune en tableau (tri, filtres et pagination côté serveur dans les vues `admin_*`, 50 lignes par page) avec actions par ligne, par lot (lignes cochées) et une fiche par élément (`/admin/livres/[id]`…). Code : `src/app/admin/` (pages, `actions.ts`), `src/lib/admin/` (`guard.ts`, `data.ts`, `messages.ts`), `src/components/admin/`.

- **Rôle** : table `public.admins` (`user_id` du compte GoTrue), invisible par l'API. Donner le rôle : `insert into admins (user_id, note) select id, 'Juliette' from auth.users where email = '…';` dans `coaut-db`. `requireAdminPage()` (404 sans le rôle) et `requireAdminAction()` (erreur) vérifient côté serveur, puis tout passe par la clé service ; `is_admin()` sert seulement au lien du menu. En préprod : `admin-test@agence-turing.com` (Bitwarden « Co-Aut — Préprod V2 (compte admin de test) ») et le compte de Toni ; `auteur-test@agence-turing.com` sert de compte non admin.
- **Équipe et tours** : fonctions SQL `admin_*` (atomiques, réservées à `service_role`) qui gardent « à qui le tour » : `admin_current_writer()` = même règle que `writingState()` (à tenir à jour ensemble). Pour changer qui écrit sans créer de faux tour, elles décalent les positions (l'ordre de passage reste le même, en cercle). Retirer un co-auteur : son brouillon est supprimé, le tour passe au suivant si c'était le sien. Ajouter : en fin d'ordre, le tour ne change pas. Passer le tour : brouillon supprimé, tour au suivant (mail « à toi d'écrire »). Supprimer un tour : les suivants sont renumérotés, l'auteur dont c'est le tour ne change pas.
- **Bloquer** : `author_profiles.blocked_at` + ban GoTrue + sessions coupées (`admin_revoke_sessions`) ; des politiques restrictives « compte bloqué » refusent toute écriture d'un jeton encore valide. Bloquer une classe = bloquer tous ses élèves (`classes.blocked_at`).
- **Supprimer un auteur** : compte GoTrue supprimé (e-mail compris), profil, demandes et favoris effacés, fiche gardée et anonymisée (« Auteur supprimé xxxxxx », `authors.deleted_at`) pour que ses tours restent dans les livres ; il quitte les livres en cours. Supprimer une classe : livres publiés gardés (deviennent publics ordinaires), autres livres supprimés, comptes des élèves supprimés. Un admin ne peut ni se bloquer ni se supprimer, ni bloquer un autre admin.
- **Modération** : colonne « Bloqué par l'IA » = `turns.moderation_status` (`blocked` / `review`) et `moderation_reason`, remplies par le chantier Modération.
- **Données personnelles** : e-mail, nom, âge, note interne ne sont lus que dans les pages `/admin` (vue `admin_authors`, clé service) ; export CSV `/admin/auteurs/export` avec les filtres en cours (séparateur `;`, UTF-8 avec BOM pour Excel).

## Couvertures des livres

Couvertures illustrées **abandonnées le 16/11** (décision de Juliette : des couleurs à la place). L'interface n'affiche que la couverture colorée composée par le code (`BookCover`), en liste comme sur la page d'un livre. La colonne `books.cover_path` (migration 0008) et les fichiers déjà générés (`/opt/coaut/couvertures` de la VM, encore monté dans `coaut-app`) sont gardés mais plus lus ; la route `/couvertures/` et le script de génération ont été retirés le 18/11 (récupérables dans l'historique git). Ne plus générer d'image par IA pour les livres.
