#!/bin/bash
# PROD — sauvegarde quotidienne de la base Co-Aut : pg_dump (format custom, schémas public + auth compris)
# gardé 7 jours dans /opt/coaut/backups du VPS et poussé sur le dédié (54.38.69.101), où une clé
# restreinte (commande forcée /opt/backups/coaut-prod/recevoir.sh) ne peut qu'écrire le fichier.
# Restauration : docker exec -i coaut-db pg_restore -U postgres -d postgres --clean --if-exists < fichier.dump
set -euo pipefail
umask 077
DIR=/opt/coaut/backups
F=$DIR/coaut-$(date +%Y%m%d-%H%M).dump
docker exec coaut-db pg_dump -U postgres -d postgres -Fc --no-owner > "$F.tmp"
mv "$F.tmp" "$F"
find "$DIR" -name 'coaut-*.dump' -mtime +7 -delete
ssh -i /root/.ssh/coaut-sauvegarde -o BatchMode=yes -o ConnectTimeout=20 ubuntu@54.38.69.101 coaut-prod < "$F"
echo "$(date -Is) OK $(basename "$F") $(stat -c %s "$F") octets"
