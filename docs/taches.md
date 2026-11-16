# Co-Aut V2 : état et reste à faire

État au 2026-11-16, établi en lisant le code du repo, l'ancien site (fronts et API compilés récupérés sur le VPS Infomaniak) et les réunions du 15/09 et du 10/11. Les lignes du devis D-2026-1121 n'ont pas été relues. Mise en ligne au plus tard le 07/12.

## Déjà codé

- Connexion et inscription (e-mail + mot de passe), pages réservées aux connectés.
- Rejoindre un livre (`/books`) avec filtres, bibliothèque des livres publiés (`/bibliotheque`), lecture d'un livre.
- Favoris : cœur, compteur, tri par popularité, « Mes favoris ».
- Lancer un livre.
- Demandes à rejoindre, acceptées ou refusées par le lanceur.
- Écriture au tour par tour : éditeur, brouillon, rotation des auteurs, verrouillage, publication par le lanceur.
- Mes livres : en cours, publiés, mes demandes, badge « à toi d'écrire ».
- Charte de l'ancien site, affichage mobile.
- Déploiement Docker (préprod coaut.agence-turing.com).
- Reprise des données Notion : script rejouable (branche `reprise-notion`, `docs/reprise-notion.md`).

## Reste à faire

### Semaine 1 : bases

- [ ] Refonte visuelle (la version actuelle reprend le design de l'ancien site).
- [ ] Mot de passe oublié : page de demande, page de nouveau mot de passe, envoi du mail.
- [ ] Message à la connexion d'un ancien compte : « Co-Aut a une nouvelle version, faites mot de passe oublié ».
- [ ] Confirmation de l'adresse e-mail à l'inscription (l'ancien site le faisait).
- [ ] Envoi de mails : service à trancher (Resend décidé le 15/09 sous réserve du choix de Juliette, clé API Brevo créée le 10/11), domaine d'envoi co-aut.com.
- [ ] Mails automatiques : « à ton tour d'écrire », deux relances, demande reçue, demande acceptée ou refusée, livre publié.
- [x] Profil : date de naissance obligatoire à l'inscription, page « Mon profil » (`/profil`) avec l'âge calculé, invitation à la compléter pour les anciens comptes.
- [ ] Profil, suite : professionnel ou non, consentement newsletter, ville et pays modifiables.
- [ ] Reprise Notion : le script réécrit la date de naissance depuis Notion à chaque passage ; à neutraliser si des auteurs la modifient avant le jour J.
- [ ] Livres proposés selon l'âge (un an d'écart autorisé), adultes séparés des enfants.
- [ ] Inscrits à la newsletter envoyés dans Brevo (Juliette le fait à la main aujourd'hui).
- [ ] Pages de l'ancien site absentes : règles du jeu, contact (formulaire), mentions légales, cookies, page d'accueil après inscription.
- [ ] Proposition de livre : sur l'ancien site, lancer un livre passait par une demande envoyée à Juliette ; à trancher (libre comme aujourd'hui, ou validé par elle).

### Semaine 2 : IA et administration

- [ ] Contrôle de chaque tour par IA : insultes, spam, contenu déplacé, coordonnées ou prise de contact.
- [ ] Correction des fautes par IA sans changer le sens des phrases.
- [ ] Réglage par livre : tout automatique, contrôle seul, ou validation à la main par Juliette (classes d'enfants dyslexiques).
- [ ] Compte super-administrateur de Juliette, rattaché à son profil d'auteur « Armonie ».
- [ ] Administration en tableaux filtrables : utilisateurs, livres, tours, demandes.
- [ ] Actions d'administration : valider ou supprimer un texte, bloquer ou supprimer un utilisateur, changer un pseudo, changer le nombre de co-auteurs, archiver un livre, passer le tour d'un auteur absent.

### Semaine 3 : finitions et mise en ligne

- [ ] Tests de bout en bout (écrire un livre jusqu'à la publication, à plusieurs comptes).
- [ ] Retours de Juliette sur la préprod.
- [ ] Serveur de production : le VPS Infomaniak (2 Go de mémoire, aucune sauvegarde, expiration affichée au 04/12) doit recevoir l'app et la pile Supabase ; vérifier que ça tient, mettre une sauvegarde.
- [ ] Jour J : export Notion frais, migration 0006, `scripts/import-notion.py --apply`, purge des données de démo, bascule du domaine.
- [ ] Arrêt de l'ancien site (API .NET, Notion).

## Questions à Juliette

- A-t-elle accès au Bitbucket de l'ancien développeur (sources de l'ancien site) ?
- Resend ou Brevo pour les mails automatiques ?
- Lancer un livre : libre, ou validé par elle ?
- 10 livres sans statut dans Notion : repris comme archivés (invisibles), d'accord ?
- 48 demandes au code suffixé `_ANN` : bien des demandes annulées ?
