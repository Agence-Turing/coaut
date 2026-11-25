#!/bin/sh
# PROD — relecture par l'IA des textes publiés sans vérification (IA en panne à l'envoi).
# Timer systemd coaut-moderation.timer (scripts/prod/cron/), activé seulement par la bascule.
set -eu
SECRET=$(grep "^CRON_SECRET=" /opt/coaut/app.env | cut -d= -f2-)
docker exec coaut-app wget -qO- --header="Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/cron/moderation
echo
