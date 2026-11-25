#!/bin/bash
# Construit l'image de PROD de l'app (coaut-app:prod) dans la VM agents à partir d'origin/main,
# puis la copie sur le VPS de Co-Aut (docker save | docker load) : pas de build Next sur le VPS.
#
# Les NEXT_PUBLIC_* sont figées au build (comme en préprod : NEXT_PUBLIC_SUPABASE_URL=http://kong:8000,
# l'API Supabase reste interne au réseau Docker). Le .env de build ne contient que ces deux lignes,
# lues dans /opt/coaut/app.env du VPS et passées de machine à machine sans être affichées.
# La préprod (/opt/coaut de la VM) n'est pas touchée : clone à part dans /tmp, tag coaut-app:prod.
#
# Usage : scripts/prod/build-image.sh [réf git, défaut origin/main]   (poste avec l'accès SSH)
# Ensuite, sur le VPS : cd /opt/coaut && sudo docker compose up -d app
set -euo pipefail
REF=${1:-main}
JUMP=ubuntu@54.38.69.101
VM=turing@192.168.200.10
VPS=debian@193.108.55.204
B=/tmp/coaut-build-prod
vm()  { ssh -o BatchMode=yes -J "$JUMP" "$VM" "$@"; }
vps() { ssh -o BatchMode=yes -J "$JUMP" "$VPS" "$@" 2> >(grep -v -e veeam -e requiretty -e '\^~' >&2); }

echo "1/4 clone de $REF dans la VM"
vm "rm -rf $B && git clone -q --depth 1 --branch '$REF' git@github.com:Agence-Turing/coaut.git $B && git -C $B log --oneline -1"

echo "2/4 .env de build (NEXT_PUBLIC_* de la prod)"
vps "sudo grep '^NEXT_PUBLIC_' /opt/coaut/app.env" | vm "umask 077; cat > $B/.env; grep -c '^NEXT_PUBLIC_' $B/.env"

echo "3/4 build"
SHA=$(vm "git -C $B rev-parse --short HEAD")
vm "cd $B && docker build -q -t coaut-app:prod -t coaut-app:prod-$SHA . && rm -f $B/.env"

echo "4/4 copie vers le VPS"
vps "sudo docker tag coaut-app:prod coaut-app:prod-precedente 2>/dev/null || true"
vm "docker save coaut-app:prod coaut-app:prod-$SHA | gzip -1" | vps "gunzip | sudo docker load"
vm "rm -rf $B; docker rmi -f coaut-app:prod coaut-app:prod-$SHA >/dev/null"
echo "Image coaut-app:prod ($SHA) chargée sur le VPS (l'ancienne reste en coaut-app:prod-precedente)."
