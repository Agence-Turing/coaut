#!/bin/bash
# DÉDIÉ (54.38.69.101) — /opt/backups/coaut-prod/recevoir.sh, commande forcée de la clé du VPS de Co-Aut
# dans ~ubuntu/.ssh/authorized_keys :
#   restrict,command="/opt/backups/coaut-prod/recevoir.sh" ssh-ed25519 AAAA… coaut-vps-sauvegarde
# Lit le dump sur l'entrée standard, le range sous un nom daté (le client ne choisit rien), garde 30 jours.
set -euo pipefail
umask 077
DIR=/opt/backups/coaut-prod
F=$DIR/coaut-$(date +%Y%m%d-%H%M%S).dump
head -c 2147483648 > "$F.tmp"
[ -s "$F.tmp" ] && [ "$(head -c 5 "$F.tmp")" = "PGDMP" ] || { rm -f "$F.tmp"; echo "refusé : pas un pg_dump" >&2; exit 1; }
mv "$F.tmp" "$F"
find "$DIR" -name 'coaut-*.dump' -mtime +30 -delete
echo "reçu $(basename "$F")"
