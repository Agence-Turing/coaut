#!/bin/bash
# Génère, SUR LE VPS de prod, /opt/coaut/.env (pile Supabase) et /opt/coaut/app.env (app Next)
# avec des secrets neufs : JWT_SECRET, POSTGRES_PASSWORD, clés anon / service_role signées (HS256,
# 10 ans), DASHBOARD_PASSWORD, CRON_SECRET, CORRECTION_SECRET. Fichiers en 600, propriété de root.
# Rien n'est affiché. Refuse d'écraser des fichiers existants (les secrets sont liés à la base :
# un nouveau POSTGRES_PASSWORD ne s'applique pas à une base déjà initialisée).
#
# Usage (sur le VPS) : sudo bash generer-secrets.sh [/opt/coaut]
# La clé Claude de Co-Aut est ajoutée à part (voir docs/mise-en-prod.md) : ANTHROPIC_API_KEY.
# SMTP de prod (Brevo) : SMTP_USER / SMTP_PASS se posent ensuite depuis Bitwarden (« Co-Aut — Brevo SMTP
# (prod) », commande dans docs/mise-en-prod.md) ; SMTP_HOST reste VIDE (aucun mail) jusqu'à la bascule,
# qui le remplit (scripts/prod/bascule.sh, étape 6).
set -euo pipefail
umask 077
DIR=${1:-/opt/coaut}
ENV=$DIR/.env
APPENV=$DIR/app.env
for f in "$ENV" "$APPENV"; do
  [ -e "$f" ] && { echo "Refus : $f existe déjà." >&2; exit 1; }
done

hex() { openssl rand -hex "$1"; }
JWT_SECRET=$(hex 32)
POSTGRES_PASSWORD=$(hex 24)
DASHBOARD_PASSWORD=$(hex 16)
CRON_SECRET=$(hex 32)
CORRECTION_SECRET=$(hex 32)

jwt() { # $1 = rôle
  ROLE=$1 SECRET=$JWT_SECRET python3 -I -c '
import base64, hashlib, hmac, json, os, time
b = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
now = int(time.time())
h = b(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b(json.dumps({"role": os.environ["ROLE"], "iss": "supabase", "iat": now,
                  "exp": now + 10 * 365 * 86400}, separators=(",", ":")).encode())
s = b(hmac.new(os.environ["SECRET"].encode(), h + b"." + p, hashlib.sha256).digest())
print((h + b"." + p + b"." + s).decode())'
}
ANON_KEY=$(jwt anon)
SERVICE_ROLE_KEY=$(jwt service_role)
GENERE=$(date +%F)

cat > "$ENV" <<EOF
############
# Co-Aut — PRODUCTION, pile Supabase auto-hébergée (secrets générés sur le VPS le $GENERE,
# copie dans Bitwarden « Co-Aut — Prod (secrets de la pile) »). Ne jamais commiter.
############
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ANON_KEY_ASYMMETRIC=
SERVICE_ROLE_KEY_ASYMMETRIC=
DASHBOARD_USERNAME=coaut
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD

# Database
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# URLs (API interne au réseau Docker ; le site public est l'app Next derrière le nginx de l'hôte)
SITE_URL=https://app.co-aut.com
API_EXTERNAL_URL=https://app.co-aut.com
SUPABASE_PUBLIC_URL=https://app.co-aut.com
ADDITIONAL_REDIRECT_URLS=https://app.co-aut.com,https://app.co-aut.com/**

# Auth : inscription ouverte, confirmation de l'adresse par mail
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# SMTP de GoTrue (confirmation d'adresse, mot de passe oublié) : Brevo, smtp-relay.brevo.com:587 (STARTTLS).
# SMTP_HOST VIDE = GoTrue n'envoie rien : la base contient les vrais auteurs, aucun mail avant la bascule.
# scripts/prod/bascule.sh le passe à smtp-relay.brevo.com ; retour-arriere.sh le revide.
SMTP_ADMIN_EMAIL=contact@co-aut.com
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Co-Aut

# PostgREST
PGRST_DB_SCHEMAS=public
PGRST_DB_MAX_ROWS=1000
PGRST_DB_EXTRA_SEARCH_PATH=public

# Port d'hôte de Kong (127.0.0.1 seulement, diagnostic)
KONG_HTTP_PORT=8011

# Modèles et sujets des mails GoTrue (fichiers du repo, public/emails/, servis par l'app)
MAILER_TEMPLATES_RECOVERY=http://app:3000/emails/recovery.html
MAILER_TEMPLATES_CONFIRMATION=http://app:3000/emails/confirmation.html
MAILER_SUBJECTS_RECOVERY="Ton nouveau mot de passe Co-Aut"
MAILER_SUBJECTS_CONFIRMATION="Confirme ton adresse pour entrer sur Co-Aut"
EOF

cat > "$APPENV" <<EOF
# Co-Aut — PRODUCTION, app Next (généré sur le VPS le $GENERE). Ne jamais commiter.
# NEXT_PUBLIC_* sont aussi figées dans l'image au build (scripts/prod/build-image.sh) : mêmes valeurs.
NEXT_PUBLIC_SUPABASE_URL=http://kong:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_ANON_PUBLIC=$ANON_KEY
SUPABASE_SERVICE_ROLE_SECRET=$SERVICE_ROLE_KEY

SITE_URL=https://app.co-aut.com
MAIL_FROM="Co-Aut <contact@co-aut.com>"
# SMTP de l'app (src/lib/mail) : Brevo, STARTTLS sur 587 (pas de SMTP_SECURE). Sans SMTP_HOST, rien ne part
# (ligne skipped) : VIDE jusqu'à la bascule (scripts/prod/bascule.sh le passe à smtp-relay.brevo.com).
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_HOST=

# Secret des routes /api/cron/relances et /api/cron/moderation (scripts cron-*.sh)
CRON_SECRET=$CRON_SECRET
# Signature des jetons de correction (src/lib/correction/jeton.ts)
CORRECTION_SECRET=$CORRECTION_SECRET

# Modération et correction : clé Claude au nom de Co-Aut (Bitwarden « Co-Aut — Anthropic API (clé Claude) »)
ANTHROPIC_API_KEY=
EOF
chmod 600 "$ENV" "$APPENV"
echo "OK : $ENV et $APPENV créés (600)."
