#!/bin/bash
# BASCULE de Co-Aut vers la nouvelle appli (jour J). À lancer depuis la racine du repo, sur un poste qui a
# l'accès SSH au VPS (par le dédié), avec un export Notion FRAIS de « Bdd - prod » (zip Markdown & CSV,
# sous-pages incluses ; jamais commité).
#
#   scripts/prod/bascule.sh /chemin/export-notion.zip [--oui]
#
# Prérequis (préparés le 25/11, voir docs/mise-en-prod.md) : pile /opt/coaut sur le VPS, image coaut-app:prod
# au niveau d'origin/main (scripts/prod/build-image.sh), secrets dans /opt/coaut/.env et app.env, timers
# systemd coaut-relances / coaut-moderation installés mais désactivés.
#
# Étapes : 1 contrôles et lecture de l'export · 2 page de maintenance (ancienne conf nginx mise de côté) ·
# 3 arrêt des services .NET (plus personne n'écrit dans Notion) · 4 certificat Let's Encrypt neuf pour les
# 4 noms (webroot /var/www/letsencrypt) · 5 base remise à zéro (sauvegarde avant) → GoTrue → migrations →
# reprise Notion → admin · 6 SMTP Brevo activé (app + GoTrue) · 7 nginx final · 8 relances et modération
# activées · 9 contrôles. Retour arrière : scripts/prod/retour-arriere.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
EXPORT=${1:?usage : scripts/prod/bascule.sh EXPORT_NOTION.zip [--oui]}
OUI=${2:-}
JUMP=ubuntu@54.38.69.101
VPS=debian@193.108.55.204
IP4=193.108.55.204
IP6=2001:1600:13:101::16c1
NOMS="app.co-aut.com auth.co-aut.com app-api.co-aut.com auth-api.co-aut.com"
ADMINS=${ADMINS:-contact@co-aut.com}   # comptes qui reçoivent le rôle admin (séparés par des espaces)
STAMP=$(date +%Y%m%d-%H%M)

vps() { ssh -o BatchMode=yes -J "$JUMP" "$VPS" "$@" 2> >(grep -v -e veeam -e requiretty -e '\^~' >&2); }
etape() { printf '\n== %s\n' "$*"; }
export COAUT_PSQL="ssh -o BatchMode=yes -J $JUMP $VPS sudo docker exec -i coaut-db psql -X -U postgres -d postgres"

etape "1/9 Contrôles"
[ -e "$EXPORT" ] || { echo "Export introuvable : $EXPORT"; exit 1; }
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "Le repo local n'est pas sur origin/main (migrations et scripts doivent être ceux de la prod)."; exit 1; }
IMG=$(vps "sudo docker images --format '{{.Tag}}' coaut-app | grep -E '^prod-[0-9a-f]+$' | head -1")
echo "Image de l'app sur le VPS : coaut-app:$IMG ; dernier commit de code : $(git log -1 --format=%h -- src public package.json Dockerfile)"
vps "sudo test -f /opt/coaut/.env && sudo test -f /opt/coaut/app.env && sudo grep -q '^SMTP_USER=.' /opt/coaut/app.env" \
  || { echo "Secrets ou SMTP absents de /opt/coaut sur le VPS."; exit 1; }
python3 -I scripts/import-notion.py "$EXPORT" | tail -25
if [ "$OUI" != "--oui" ]; then
  read -r -p "Lancer la bascule (coupure ~1 h) ? Tape BASCULE : " R; [ "$R" = BASCULE ] || exit 1
fi

etape "2/9 Page de maintenance"
tar cf - -C scripts/prod nginx | vps "rm -rf /tmp/coaut-nginx && mkdir /tmp/coaut-nginx && tar xf - -C /tmp/coaut-nginx"
vps "sudo bash -s" <<EOF
set -e
T=/tmp/coaut-nginx
tar czf /opt/coaut/backups/nginx-avant-bascule-$STAMP.tar.gz -C / etc/nginx etc/letsencrypt
install -d -m 755 /etc/nginx/coaut /var/www/letsencrypt /var/www/coaut-maintenance
install -m 644 \$T/nginx/ssl.inc /etc/nginx/coaut/ssl.inc
install -m 644 \$T/nginx/coaut.conf /etc/nginx/coaut/coaut.conf
install -m 644 \$T/nginx/coaut-maintenance.conf /etc/nginx/coaut/coaut-maintenance.conf
install -m 644 \$T/nginx/maintenance.html /var/www/coaut-maintenance/index.html
rm -rf \$T
[ -f /etc/nginx/conf.d/sites.conf ] && mv /etc/nginx/conf.d/sites.conf /etc/nginx/sites.conf.desactive
cp /etc/nginx/coaut/coaut-maintenance.conf /etc/nginx/conf.d/coaut.conf
nginx -t -q && systemctl reload nginx
EOF
curl -s -o /dev/null -w "maintenance : %{http_code}\n" --resolve app.co-aut.com:443:$IP4 -k https://app.co-aut.com/

etape "3/9 Arrêt des services .NET"
vps "sudo systemctl disable --now coaut-app-api-prod coaut-auth-api-prod && systemctl is-active coaut-app-api-prod coaut-auth-api-prod || true"

etape "4/9 Certificat Let's Encrypt (4 noms)"
D=""; for n in $NOMS; do D="$D -d $n"; done
vps "sudo certbot certonly --non-interactive --cert-name coaut-prod --webroot -w /var/www/letsencrypt $D \
       --key-type ecdsa --force-renewal --deploy-hook 'systemctl reload nginx' \
     && sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/coaut-prod/cert.pem && sudo systemctl reload nginx"

etape "5/9 Base remise à zéro, migrations, reprise Notion"
vps "sudo /opt/coaut/cron/sauvegarde.sh" || echo "(sauvegarde avant remise à zéro en échec : la base n'est que la répétition, on continue)"
vps "sudo bash -s" <<'EOF'
set -e
cd /opt/coaut
docker compose down
rm -rf volumes/db/data && install -d volumes/db/data
docker volume rm coaut_db-config >/dev/null
docker compose up -d db auth
# GoTrue doit avoir créé le schéma auth (auth.sessions…) avant nos migrations (0010 s'en sert).
for i in $(seq 1 90); do
  [ "$(docker exec coaut-db psql -U postgres -tAc "select to_regclass('auth.sessions') is not null" 2>/dev/null)" = t ] && break; sleep 2
done
docker exec coaut-db psql -U postgres -tAc "select 'schéma auth prêt : ' || (to_regclass('auth.sessions') is not null)"
EOF
for f in supabase/migrations/0*.sql; do
  printf '%s ' "$(basename "$f")"
  vps "sudo docker exec -i coaut-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null" < "$f"
done; echo
ESSAI=$(python3 -I scripts/import-notion.py "$EXPORT" --dry-run)
printf '%s\n' "$ESSAI" | sed -n '/== Base/,$p'
if printf '%s\n' "$ESSAI" | grep -E '^ +[1-9][0-9]* +CONFLIT'; then
  echo "CONFLIT dans l'essai à blanc : arrêt (maintenance toujours en place ; corriger puis relancer ou retour-arriere.sh)."; exit 1
fi
python3 -I scripts/import-notion.py "$EXPORT" --apply | sed -n '/== Base/,$p' | grep -E 'TOTAL|CONFLIT|validé'
for a in $ADMINS; do
  vps "sudo docker exec -i coaut-db psql -X -tA -U postgres -d postgres" <<SQL
insert into admins (user_id, note) select id, 'admin (bascule $STAMP)' from auth.users where email = '$a' on conflict do nothing;
select '$a admin : ' || exists(select 1 from admins x join auth.users u on u.id = x.user_id where u.email = '$a');
SQL
done

etape "6/9 SMTP Brevo activé (app + GoTrue) et démarrage de la pile"
vps "sudo bash -s" <<'EOF'
set -e
cd /opt/coaut
sed -i 's/^SMTP_HOST=$/SMTP_HOST=smtp-relay.brevo.com/' .env app.env
grep -c '^SMTP_HOST=smtp-relay.brevo.com$' .env app.env
docker compose up -d
for i in $(seq 1 60); do [ "$(docker inspect -f '{{.State.Health.Status}}' coaut-app)" = healthy ] && break; sleep 2; done
docker compose ps --format '{{.Name}} {{.Status}}'
EOF

etape "7/9 nginx final"
vps "sudo sh -c 'cp /etc/nginx/coaut/coaut.conf /etc/nginx/conf.d/coaut.conf && nginx -t -q && systemctl reload nginx'"

etape "8/9 Relances (9 h-19 h, heure de Paris) et modération (15 min) activées"
vps "sudo systemctl enable --now coaut-relances.timer coaut-moderation.timer coaut-sauvegarde.timer && systemctl list-timers 'coaut-*' --no-pager"

etape "9/9 Contrôles"
set +e   # un contrôle raté (poste sans IPv6 par exemple) ne doit pas interrompre les suivants
for ip in "$IP4" "[$IP6]"; do
  curl -s -o /dev/null -w "https://app.co-aut.com/ via $ip : %{http_code}\n" --resolve "app.co-aut.com:443:$ip" https://app.co-aut.com/
  for n in auth app-api auth-api; do
    curl -s -o /dev/null -w "https://$n.co-aut.com via $ip : %{http_code} → %{redirect_url}\n" --resolve "$n.co-aut.com:443:$ip" "https://$n.co-aut.com/"
  done
done
curl -s -o /dev/null -w "http://app.co-aut.com : %{http_code} → %{redirect_url}\n" --resolve "app.co-aut.com:80:$IP4" http://app.co-aut.com/
echo | openssl s_client -connect $IP4:443 -servername app.co-aut.com 2>/dev/null | openssl x509 -noout -enddate -ext subjectAltName
cat <<'EOF'

Bascule faite. Reste à la main (docs/mise-en-prod.md, « Recette en prod ») :
- « Mot de passe oublié » sur un compte repris : vrai mail reçu (Brevo, 300 mails/jour en gratuit) ;
- lancer / rejoindre / écrire un tour sur un livre de test, puis le supprimer ; page /admin ;
- prévenir Juliette.
EOF
