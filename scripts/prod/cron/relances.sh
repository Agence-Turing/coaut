#!/bin/sh
# PROD — relances « à toi d'écrire » : appelle la route protégée de l'app (secret lu dans /opt/coaut/app.env).
# Timer systemd coaut-relances.timer (scripts/prod/cron/), activé seulement par la bascule.
set -eu
SECRET=$(grep "^CRON_SECRET=" /opt/coaut/app.env | cut -d= -f2-)
docker exec coaut-app wget -qO- --header="Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/cron/relances
echo
