#!/bin/bash
# Pose le login et la clé SMTP Brevo de Co-Aut (Bitwarden « Co-Aut — Brevo SMTP (prod) », bf274201) dans
# /opt/coaut/.env (GoTrue) et /opt/coaut/app.env (app) du VPS, sans les afficher (skill credential).
# Ne touche PAS à SMTP_HOST : il reste vide (aucun mail) jusqu'à scripts/prod/bascule.sh.
# Usage : scripts/prod/poser-smtp.sh   (poste avec l'accès SSH et le coffre déverrouillé)
set -euo pipefail
~/.claude/skills/credential/scripts/cred run bf274201 -- sh -c '
printf "%s\n%s\n" "$CRED_USERNAME" "$CRED_PASSWORD" |
ssh -o BatchMode=yes -J ubuntu@54.38.69.101 debian@193.108.55.204 "sudo python3 -I -c \"
import re, sys
u, p = [l.strip() for l in sys.stdin.read().splitlines()[:2]]
assert u and p
for f in (\\\"/opt/coaut/.env\\\", \\\"/opt/coaut/app.env\\\"):
    t = open(f).read()
    t = re.sub(r\\\"(?m)^SMTP_USER=.*$\\\", lambda m: \\\"SMTP_USER=\\\" + u, t)
    t = re.sub(r\\\"(?m)^SMTP_PASS=.*$\\\", lambda m: \\\"SMTP_PASS=\\\" + p, t)
    open(f, \\\"w\\\").write(t)
print(\\\"SMTP Brevo posé (SMTP_HOST inchangé)\\\")
\""'
