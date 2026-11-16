#!/bin/bash
# Met en ligne origin/main sur la préprod (VM agents, /opt/coaut) : tire le code dans le clone
# de la VM, reconstruit l'image et redémarre l'app, sous verrou (plusieurs agents déploient).
# L'image d'avant reste disponible sous coaut-app:precedente pour revenir en arrière.
# Usage : scripts/deploy-preprod.sh            (depuis un poste qui a l'accès SSH à la VM)
set -euo pipefail
JUMP=ubuntu@54.38.69.101
VM=turing@192.168.200.10

ssh -o BatchMode=yes -J "$JUMP" "$VM" 'cd /opt/coaut && flock .deploy.lock sh -c "
  set -e
  git -C app pull -q --ff-only
  docker tag coaut-app:latest coaut-app:precedente 2>/dev/null || true
  docker compose build -q app
  docker compose up -d app
  for i in \$(seq 1 30); do
    [ \"\$(docker inspect -f {{.State.Health.Status}} coaut-app)\" = healthy ] && break
    sleep 2
  done
  docker inspect -f \"coaut-app : {{.State.Health.Status}}\" coaut-app
  git -C app log --oneline -1
"'
curl -s -o /dev/null -m 20 -w "https://coaut.agence-turing.com → %{http_code}\n" https://coaut.agence-turing.com/
