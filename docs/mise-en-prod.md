# Mise en production (préparée le 25/11/2026)

Feu vert de Toni le 25/11. **Préparation faite (étapes 1 à 3) ; la bascule (étapes 5 et suivantes) reste à lancer** avec `scripts/prod/bascule.sh`.

## État de l'existant

- **Ancienne appli** : VPS Infomaniak de Co-Aut `193.108.55.204` / `2001:1600:13:101::16c1` (Debian 12, **4 vCPU, 3,8 Go** depuis le redimensionnement du 25/11 à 14 h 23 UTC, + 1 Go de swap ajouté le 25/11, 30 Go libres, Docker 27). SSH uniquement via le dédié : `ssh -J ubuntu@54.38.69.101 debian@193.108.55.204` (sudo sans mot de passe ; `debian` n'est pas dans le groupe docker : `sudo docker …`).
  - nginx (`/etc/nginx/conf.d/sites.conf` → `sites.d/coaut-*`) : `app.co-aut.com` et `auth.co-aut.com` (Angular, `/var/www/coaut-app-prod`, `/var/www/coaut-auth-prod`), `app-api.co-aut.com` (port 6002) et `auth-api.co-aut.com` (port 6003), services systemd `coaut-app-api-prod` et `coaut-auth-api-prod` (.NET, `/var/dotnet/coaut-*-prod`). Les comptes de l'ancienne appli (mots de passe hachés ASP.NET Identity, non réutilisables par GoTrue) sont dans `/var/data/coaut-auth-api-prod/coaut-auth.db` (SQLite) ; tout le reste est dans **Notion**.
  - **Archive** de l'existant (nginx, letsencrypt, units systemd, `/var/www`, `/var/dotnet`, `/var/data`, dhparam) : `/opt/backups/coaut-ancien-vps/coaut-ancien-vps-20261125-1520.tar.gz` sur le dédié (42 Mo, sha256 `5b452f76…`). Pas de snapshot Infomaniak (pas d'accès API) : les données sont dans Notion.
  - **Certificat HTTPS** (`/etc/letsencrypt/live/coaut-prod`, les 4 noms) : **expire le 26/11 à 12 h 04 UTC**. Cause de l'échec des renouvellements : `certbot.service` tourne en `PrivateTmp=true`, donc le webroot `/tmp` de certbot n'est pas celui de nginx. Lancé à la main (hors systemd), le renouvellement passe (`certbot renew --cert-name coaut-prod --dry-run` réussi le 25/11). **Si la bascule n'est pas faite avant le 26/11 midi** : `sudo certbot renew --cert-name coaut-prod && sudo systemctl reload nginx` sur le VPS garde l'ancienne appli en HTTPS. La bascule refait le certificat avec le webroot `/var/www/letsencrypt` (corrige le renouvellement automatique).
  - netdata écoute en public sur le port 19999 (installé par l'ancien prestataire) : à couper après la bascule.
  - Expiration du VPS affichée au 04/12 : Juliette doit le renouveler.
- **DNS** : zone `co-aut.com` chez OVH. `co-aut.com` et `www` → site vitrine (51.91.236.255, on n'y touche pas). `app`, `auth`, `app-api`, `auth-api` → VPS en A **et AAAA** (nginx doit écouter en IPv6 ; Let's Encrypt valide en IPv6). MX OVH. Rien à changer pour la bascule.

## Ce qui est prêt sur le VPS (25/11)

Tout est dans `/opt/coaut`, fichiers de référence dans `scripts/prod/` du repo :

| Élément | Où | Source dans le repo |
|---|---|---|
| Pile (app, Kong, GoTrue, PostgREST, Postgres ; mêmes images que la préprod, sans Mailpit, ports sur 127.0.0.1 : app `3100`, Kong `8011`) | `/opt/coaut/docker-compose.yml` | `scripts/prod/docker-compose.yml` |
| Secrets neufs (JWT, mot de passe Postgres, clés anon / service_role, `CRON_SECRET`, `CORRECTION_SECRET`, tableau de bord Kong) | `/opt/coaut/.env` (pile) et `/opt/coaut/app.env` (app), root, 600 | générés sur le VPS par `scripts/prod/generer-secrets.sh` ; copie dans Bitwarden « Co-Aut — Prod (secrets de la pile) » (`d61a4f17`, collection CoAut) |
| Clé Claude de Co-Aut | `ANTHROPIC_API_KEY` de `app.env` | Bitwarden « Co-Aut — Anthropic API (clé Claude) » (`896adcc9`) |
| SMTP Brevo (`smtp-relay.brevo.com:587`, STARTTLS) : login et clé posés, **`SMTP_HOST` vide** dans `.env` et `app.env` → aucun mail ne part (ni GoTrue ni l'app) | `.env`, `app.env` | `scripts/prod/poser-smtp.sh` (Bitwarden « Co-Aut — Brevo SMTP (prod) », `bf274201`) ; la bascule remplit `SMTP_HOST` |
| Image de l'app `coaut-app:prod` (= `prod-34b2857`), `NEXT_PUBLIC_SUPABASE_URL=http://kong:8000` et clé anon de prod figées au build | Docker du VPS | `scripts/prod/build-image.sh` (build dans la VM agents, `docker save | docker load`) |
| Base : migrations 0001 → 0017 + **répétition de la reprise Notion** (export du 25/11) + rôle admin de `contact@co-aut.com` | `coaut-db` | `supabase/migrations/`, `scripts/import-notion.py` |
| Timers systemd (heure de Paris) : `coaut-sauvegarde` **actif** (3 h 30), `coaut-relances` (9 h-19 h, à h07) et `coaut-moderation` (15 min) **installés, désactivés** jusqu'à la bascule | `/etc/systemd/system/coaut-*`, scripts et journaux dans `/opt/coaut/cron/` | `scripts/prod/cron/` (pas de cron sur ce Debian : timers systemd) |
| Sauvegarde quotidienne : `pg_dump -Fc` gardé 7 jours dans `/opt/coaut/backups` et poussé sur le dédié (`/opt/backups/coaut-prod/`, 30 jours) par une clé SSH restreinte (commande forcée `recevoir.sh`, ne peut qu'écrire un dump) | VPS `/root/.ssh/coaut-sauvegarde`, dédié `~ubuntu/.ssh/authorized_keys` | `scripts/prod/cron/sauvegarde.sh`, `recevoir-sauvegarde.sh` |
| Conf nginx (maintenance + finale, IPv4 et IPv6, http2) et page de maintenance : **pas installées**, vérifiées par `nginx -t` à part | — | `scripts/prod/nginx/` |

Mémoire au 25/11, les services .NET tournant encore : pile Co-Aut ~300 Mo (Kong 110, base 100, app 55, GoTrue 35, PostgREST 8), 2,7 Go disponibles sur 3,8. Limites : base 1 Go, app et Kong 512 Mo, GoTrue et PostgREST 256 Mo.

**Brevo** : domaine `co-aut.com` déjà authentifié chez Brevo depuis 2023 (vérifié par l'API le 25/11 : `authenticated: true`, `brevo-code` + DKIM `mail._domainkey` dans la zone OVH, DMARC `p=none`) : rien à changer dans le DNS. Compte gratuit = **300 mails par jour** (mails GoTrue + mails de l'app confondus). Au-delà, Brevo refuse : surveiller le jour de l'annonce aux auteurs (« mot de passe oublié » en masse) et étaler l'annonce, ou passer à une offre payante.

### Répétition de la reprise Notion (25/11, export du jour)

Base vierge + migrations, essai à blanc puis import, 0 conflit ; second passage : tout à 0 (rejouable).

| | |
|---|---|
| Auteurs | 434 (433 avec un compte sans mot de passe ; le 434e, « Backloop », vient de l'ancien seed, supprimé de Notion, sans tour : comme en préprod) |
| Livres | 129 : 91 en cours (`launched`, dont 39 « Commencé » fermés et 38 avec places fixées par « Recherche N co-auteurs »), 28 publiés, 10 archivés |
| Places d'équipe | 233 |
| Tours | 822 (781 avec texte) |
| Demandes | 164 |
| Écartés | 207 tours et 119 demandes sur des livres supprimés de Notion, 48 demandes annulées (`_ANN`), 10 d'un joueur supprimé, 9 doublons, 2 livres vides |

Armonie a bien son compte (`juliettelejeune2@free.fr`, pas de compte de démo « cocotte » en prod). `contact@co-aut.com` = compte repris « pomme2025 », admin.

### Tests faits par tunnel (sans DNS, sans mail)

Accueil, `/classe`, modèles de mail : 200 ; `/books` sans session → connexion ; compte repris sans mot de passe → connexion refusée (normal). Avec un compte jetable créé par l'API admin (adresse confirmée d'office), admin temporaire puis supprimé : `/books`, `/bibliotheque` (58 fiches), `/books/mes-livres`, `/profil`, `/admin/livres`, `/admin/auteurs`, tours en retard, livre « 052 » : 200. `mail_log` vide. Une fois sur trois, `/books` a répondu 500 « JWT issued at future » (requête dans la même seconde que la connexion) : non reproduit ensuite, jamais vu en préprod.

Tester soi-même : `ssh -L 3100:127.0.0.1:3100 -J ubuntu@54.38.69.101 debian@193.108.55.204` puis http://localhost:3100 (les cookies de session sont posés pour `localhost`).

### Piège trouvé

Sur une base vierge, **GoTrue doit démarrer avant nos migrations** : il crée lui-même le schéma `auth` (`auth.sessions`…) dont la migration 0010 a besoin. `bascule.sh` démarre `db` + `auth` et attend `auth.sessions` avant de passer les migrations.

## Bascule (coupure ~1 h)

Pré-requis : repo local sur `origin/main` ; si le code a changé depuis `34b2857`, refaire l'image (`scripts/prod/build-image.sh`, sans coupure).

1. Exporter Notion « Bdd - prod » (Markdown & CSV, sous-pages incluses), **au moment de la bascule**.
2. `scripts/prod/bascule.sh /chemin/export.zip` (demande de taper `BASCULE`) :
   - contrôles (repo, secrets, SMTP posé, lecture de l'export) ;
   - **maintenance** : ancienne `conf.d/sites.conf` mise de côté (`/etc/nginx/sites.conf.desactive`), sauvegarde de `/etc/nginx` + `/etc/letsencrypt` dans `/opt/coaut/backups/`, page `/var/www/coaut-maintenance` (503) sur les 4 noms ;
   - arrêt et désactivation des services .NET (plus personne n'écrit dans Notion) ;
   - **certificat** neuf `coaut-prod` pour les 4 noms, webroot `/var/www/letsencrypt`, hook de rechargement de nginx ;
   - sauvegarde de la base de répétition, **base remise à zéro**, GoTrue, migrations 0001 → 0017, essai à blanc (arrêt s'il y a un CONFLIT), import, rôle admin (`ADMINS="contact@co-aut.com autre@…"` pour en ajouter) ;
   - **SMTP activé** (`SMTP_HOST=smtp-relay.brevo.com` dans `.env` et `app.env`), pile redémarrée ;
   - nginx final : `app.co-aut.com` → `127.0.0.1:3100`, `auth` / `app-api` / `auth-api` → 301 vers `https://app.co-aut.com/`, HTTP → HTTPS ;
   - timers relances et modération activés ;
   - contrôles en IPv4 et IPv6, redirections, dates du certificat.
3. Recette en prod : « mot de passe oublié » sur un compte repris (vrai mail reçu), lancer / rejoindre / écrire un tour sur un livre de test puis le supprimer, `/admin`. Puis prévenir Juliette.

### Retour arrière

`scripts/prod/retour-arriere.sh` : timers relances et modération coupés, `SMTP_HOST` revidé, app arrêtée (base sauvegardée avant), ancienne conf nginx remise, services .NET relancés. Notion n'a pas bougé : l'ancienne appli repart telle quelle (avec le certificat neuf, valable pour les 4 noms). Ce qui a été écrit sur le nouveau site entre-temps n'existe pas dans l'ancien.

### Après

- Prévenir les auteurs (Juliette, via Brevo) : nouveau site, choisir un mot de passe avec « mot de passe oublié ». Attention aux 300 mails par jour du compte gratuit.
- Désinstaller les services .NET et netdata après quelques jours sans retour arrière.

## Commandes utiles (VPS)

```bash
ssh -J ubuntu@54.38.69.101 debian@193.108.55.204
cd /opt/coaut && sudo docker compose ps                     # état de la pile
sudo docker exec -it coaut-db psql -U postgres              # base
sudo systemctl list-timers 'coaut-*' --all                  # relances, modération, sauvegarde
sudo tail /opt/coaut/cron/*.log                             # journaux des tâches
scripts/prod/build-image.sh && ssh … 'cd /opt/coaut && sudo docker compose up -d app'   # nouvelle version de l'app
# Restaurer une sauvegarde : sudo docker exec -i coaut-db pg_restore -U postgres -d postgres --clean --if-exists < fichier.dump
```

Migrations à venir : `ssh … 'sudo docker exec -i coaut-db psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres' < supabase/migrations/00NN_….sql`.
