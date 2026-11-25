# Mise en production (préparée le 25/11/2026)

## État de l'existant

- **Ancienne appli** : VPS Infomaniak de Co-Aut `193.108.55.204` (Debian 12, 1,9 Go de mémoire, 30 Go libres, Docker 27 déjà installé). SSH uniquement via le dédié : `ssh -J ubuntu@54.38.69.101 debian@193.108.55.204`.
  - nginx (`/etc/nginx/sites.d/coaut-*`) : `app.co-aut.com` et `auth.co-aut.com` (fichiers statiques dans `/var/www/coaut-app-prod` et `/var/www/coaut-auth-prod`), `app-api.co-aut.com` (port 6002) et `auth-api.co-aut.com` (port 6003), services systemd `coaut-app-api-prod` et `coaut-auth-api-prod` (.NET).
  - Les données sont dans **Notion**, pas sur le VPS : la vraie sauvegarde est l'export Notion.
  - **Certificat HTTPS** (`/etc/letsencrypt/live/coaut-prod`, les 4 domaines) : **expire le 26/11 à 12 h 04 UTC**, renouvellement automatique en échec (webroot `/tmp`). À refaire à la bascule.
  - Aucune sauvegarde ni snapshot. Expiration du VPS affichée au 04/12 : Juliette doit le renouveler.
- **DNS** : zone `co-aut.com` chez OVH. `co-aut.com` et `www` → site vitrine (51.91.236.255, on n'y touche pas). `app`, `auth`, `app-api`, `auth-api` → VPS. MX OVH.
- **Nouvelle appli** : préprod dans la VM agents (`/opt/coaut`). Mémoire de la pile : ~600 Mo (Kong 260, base 115, app 105, rest 65, auth 30) : tient sur le VPS une fois les services .NET arrêtés.

## À trancher avant (bloquant)

1. **Envoi des mails en prod** : Brevo (compte de Juliette, clé créée le 10/11) ou Resend. Il faut déclarer `co-aut.com` (SPF + DKIM chez OVH). Sans mails, ni confirmation d'inscription ni « mot de passe oublié » : les auteurs repris (comptes sans mot de passe) ne peuvent pas entrer.
2. **Clé Claude de Co-Aut** (créée le 24/11 sur le compte de Juliette) : à ranger dans Bitwarden.
3. **Compte admin de Juliette** : quelle adresse.
4. **Armonie** : sans compte (adresse `juliettelejeune2@free.fr` déjà prise par « cocotte », compte de démo du 25/07). Supprimer « cocotte » avant la reprise rend l'adresse à Armonie.

## Plan

### Préparation (sans coupure)

1. Snapshot du VPS dans le manager Infomaniak + archive de `/etc/nginx`, `/etc/letsencrypt`, `/etc/systemd/system/coaut-*`, `/var/www` vers le dédié.
2. Pile sur le VPS dans `/opt/coaut` : compose de la préprod **sans Mailpit**, `.env` de prod avec des secrets neufs (JWT, mots de passe base, `CRON_SECRET`), `SITE_URL=https://app.co-aut.com`, SMTP du fournisseur retenu, clé Claude de Co-Aut. Image de l'app buildée dans la VM puis copiée (`docker save | ssh … docker load`) : un build Next sur 2 Go risque de manquer de mémoire.
3. Base vide → migrations 0001 à 0017 → répétition de la reprise Notion (`docs/reprise-notion.md`) pour vérifier les compteurs. Test de l'app par un tunnel SSH, sans toucher au DNS.
4. SPF + DKIM du fournisseur de mails dans la zone OVH.

### Bascule (coupure ~1 h)

5. Page de maintenance sur `app.co-aut.com`, arrêt des services .NET (plus personne n'écrit dans Notion).
6. Export Notion frais → base remise à zéro → migrations → `scripts/import-notion.py --apply` → purge des données de démo.
7. nginx : `app.co-aut.com` → app Next (port local) ; `auth`, `app-api`, `auth-api` → redirection vers `app.co-aut.com`. Nouveau certificat Let's Encrypt.
8. Rôle admin de Juliette (et Toni), crons relances (toutes les heures 9 h-19 h) et modération (15 min), sauvegarde quotidienne de la base vers le dédié.
9. Recette en prod : connexion d'un compte repris par « mot de passe oublié » (vrai mail reçu), lancer / rejoindre / écrire un tour sur un livre de test, admin. Puis prévenir Juliette.

### Retour arrière

Notion n'est pas modifié : relancer les services .NET et remettre l'ancienne conf nginx (archive de l'étape 1) suffit.

### Après

- Prévenir les auteurs (Juliette, via Brevo) : nouveau site, choisir un mot de passe avec « mot de passe oublié ».
- Désinstaller les services .NET après quelques jours sans retour arrière.
