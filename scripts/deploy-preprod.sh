#!/bin/bash
# Met en ligne origin/main sur la préprod (VM agents, /opt/coaut) : pousse le code dans le clone
# de la VM (elle n'a pas d'accès GitHub), reconstruit l'image et redémarre l'app, sous verrou.
# Usage : scripts/deploy-preprod.sh            (depuis un poste qui a l'accès SSH à la VM)
set -euo pipefail
JUMP=ubuntu@54.38.69.101
VM=turing@192.168.200.10

git fetch -q origin main
GIT_SSH_COMMAND="ssh -o BatchMode=yes -J $JUMP" git push -q "ssh://$VM/opt/coaut/app" origin/main:main
ssh -o BatchMode=yes -J "$JUMP" "$VM" 'cd /opt/coaut && flock .deploy.lock sh -c "
  set -e
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
