# Co-Aut prod — TLS commun aux 4 noms (inclus par coaut.conf et coaut-maintenance.conf).
# Certificat Let's Encrypt « coaut-prod » (app, auth, app-api, auth-api.co-aut.com), webroot
# /var/www/letsencrypt (plus /tmp : certbot.service tourne en PrivateTmp, d'où l'échec des renouvellements).
ssl_certificate /etc/letsencrypt/live/coaut-prod/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/coaut-prod/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_timeout 1h;
ssl_session_cache shared:SSL:10m;
ssl_session_tickets off;
add_header Strict-Transport-Security "max-age=31536000" always;
