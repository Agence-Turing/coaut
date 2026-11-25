#!/bin/bash
# RETOUR ARRIÈRE après scripts/prod/bascule.sh : remet l'ancienne appli (.NET + Angular + Notion) en ligne.
# Notion n'est pas modifié par la bascule : relancer les services .NET et remettre l'ancienne conf nginx suffit.
# Ce qui a été écrit sur le nouveau site entre-temps est perdu pour l'ancien (resté dans la base de la
# nouvelle pile, sauvegardée ici avant l'arrêt).
#
#   scripts/prod/retour-arriere.sh [--oui]
#
# - coupe les envois de la nouvelle appli : timers relances et modération désactivés, SMTP_HOST vidé
#   (app + GoTrue), app arrêtée ;
# - nginx : conf.d/coaut.conf retirée, ancienne conf.d/sites.conf remise (le certificat coaut-prod reste
#   celui de la bascule, valable pour les 4 noms) ;
# - services coaut-app-api-prod et coaut-auth-api-prod réactivés et démarrés.
set -euo pipefail
JUMP=ubuntu@54.38.69.101
VPS=debian@193.108.55.204
vps() { ssh -o BatchMode=yes -J "$JUMP" "$VPS" "$@" 2> >(grep -v -e veeam -e requiretty -e '\^~' >&2); }

if [ "${1:-}" != "--oui" ]; then
  read -r -p "Remettre l'ancienne appli en ligne ? Tape RETOUR : " R; [ "$R" = RETOUR ] || exit 1
fi

vps "sudo bash -s" <<'EOF'
set -e
echo "== Nouvelle appli : plus aucun envoi"
systemctl disable --now coaut-relances.timer coaut-moderation.timer 2>/dev/null || true
cd /opt/coaut
/opt/coaut/cron/sauvegarde.sh || echo "(sauvegarde en échec, on continue)"
sed -i 's/^SMTP_HOST=.*/SMTP_HOST=/' .env app.env
docker compose stop app
docker compose up -d auth

echo "== nginx : ancienne conf"
if [ -f /etc/nginx/sites.conf.desactive ]; then
  mv /etc/nginx/sites.conf.desactive /etc/nginx/conf.d/sites.conf
fi
rm -f /etc/nginx/conf.d/coaut.conf
nginx -t -q && systemctl reload nginx

echo "== Services .NET"
systemctl enable --now coaut-app-api-prod coaut-auth-api-prod
sleep 5
systemctl is-active coaut-app-api-prod coaut-auth-api-prod nginx
EOF

for n in app auth app-api auth-api; do
  curl -s -o /dev/null -m 15 -w "https://$n.co-aut.com/.test-ssl : %{http_code}\n" --resolve "$n.co-aut.com:443:193.108.55.204" "https://$n.co-aut.com/.test-ssl"
done
echo "Ancienne appli remise. Si la conf nginx d'origine manque : /opt/coaut/backups/nginx-avant-bascule-*.tar.gz (VPS)"
echo "ou /opt/backups/coaut-ancien-vps/ (dédié)."
