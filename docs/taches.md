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

- [x] Refonte visuelle : direction « Carnet » sur tous les écrans et les mails (2026-11-16), étagère de couvertures et fil des tours. Reste : planches et relecture par Juliette.
- [x] Mot de passe oublié : page de demande, page de nouveau mot de passe, envoi du mail (testé en préprod avec un compte repris de Notion).
- [x] Message à la connexion d'un ancien compte : « Co-Aut a une nouvelle version, faites mot de passe oublié » (affiché à tout échec de connexion, pour ne pas révéler qui a un compte).
- [x] Confirmation de l'adresse e-mail à l'inscription, pseudo réservé dès l'inscription, renvoi du mail possible.
- [ ] Envoi de mails en production : service à trancher (Resend décidé le 15/09 sous réserve du choix de Juliette, clé API Brevo créée le 10/11), domaine d'envoi co-aut.com.
- [x] Mails automatiques : « à ton tour d'écrire », deux relances (4 et 8 jours), demande reçue, demande acceptée ou refusée, livre publié. En préprod tout arrive dans Mailpit.
- [ ] Mails, suite : textes à faire relire par Juliette ; protéger les liens des mails contre les antivirus de messagerie qui les ouvrent avant l'utilisateur (le lien est à usage unique).
- [x] Profil : date de naissance obligatoire à l'inscription, page « Mon profil » (`/profil`) avec l'âge calculé, invitation à la compléter pour les anciens comptes.
- [ ] Profil, suite : professionnel ou non, consentement newsletter, ville et pays modifiables.
- [ ] Reprise Notion : le script réécrit la date de naissance depuis Notion à chaque passage ; à neutraliser si des auteurs la modifient avant le jour J.
- [ ] Livres proposés selon l'âge (un an d'écart autorisé), adultes séparés des enfants.
- [ ] Inscrits à la newsletter envoyés dans Brevo (Juliette le fait à la main aujourd'hui).
- [ ] Pages de l'ancien site absentes : règles du jeu, contact (formulaire), mentions légales, cookies, page d'accueil après inscription. Les liens « Mentions légales » et « Politique de confidentialité » du pied de page (pages inexistantes) ont été retirés en attendant.
- [x] Mentions légales et politique de confidentialité (réunion du 20/11) : liens vers les pages du site de Juliette (co-aut.com/mentions-legales, co-aut.com/politique-de-confidentialite) dans le pied de page, ajouté aussi à l'accueil (connexion, inscription) et aux pages d'accès au compte (2026-11-24).
- [ ] Proposition de livre : sur l'ancien site, lancer un livre passait par une demande envoyée à Juliette ; à trancher (libre comme aujourd'hui, ou validé par elle).

### Semaine 2 : IA et administration

- [x] Contrôle de chaque tour par IA : insultes, spam, contenu déplacé, coordonnées ou prise de contact (2026-11-18 : repérage par le code + Claude Haiku avant publication, sur les tours, les demandes et les livres lancés ; voir « Modération » dans `AGENTS.md`).
- [x] Correction des fautes par IA sans changer le sens des phrases (2026-11-18 : liste de corrections mot par mot par Claude Haiku, filtrée par le code, relue et validée par l'auteur avant l'envoi ; voir « Correction » dans `AGENTS.md`).
- [ ] Réglage par livre : tout automatique, contrôle seul, ou validation à la main par Juliette (classes d'enfants dyslexiques).
- [ ] Compte super-administrateur de Juliette, rattaché à son profil d'auteur « Armonie ». Le rôle existe (table `admins`, voir AGENTS.md) ; à donner à son compte : « Armonie » n'a pas de compte de connexion en préprod et quatre comptes à son nom existent (pomme2025 / contact@co-aut.com, cocotte / juliettelejeune2@free.fr, Minipuce, Anonyme_CoAut), lequel ?
- [x] Interface d'administration : spécification validée dans `docs/administration.md` (18/11), en préprod le 18/11 sur `/admin` (Livres, Auteurs, Tours, Classes).
- [x] Administration en tableaux filtrables : auteurs, livres, tours, classes (tri, recherche, pagination côté serveur, export CSV des auteurs). Les demandes à rejoindre n'ont pas de tableau (hors spécification du 18/11).
- [x] Actions d'administration : modifier ou supprimer un texte, bloquer ou supprimer un utilisateur, changer un pseudo, changer le nombre de co-auteurs, archiver un livre, passer le tour d'un auteur absent. Pas de « valider » : aucune file de validation (spécification du 18/11).

### Hors devis : livres privés pour les élèves

- [x] Comptes professionnels, « Mes classes », un code par élève, livres réservés à une classe, page co-aut.com/classe : voir `docs/livres-prives-eleves.md` (décidé à la démo du 16/11, en préprod le 18/11). Reste : case « professionnel » à l'inscription (aujourd'hui dans « Mon profil » seulement), glisser-déposer de l'ordre (flèches aujourd'hui).

### Semaine 3 : finitions et mise en ligne

- [x] Retour de Juliette du 20/11 « je peux écrire seule » : le lanceur écrit le tour 1, puis l'écriture attend que l'équipe soit au complet (règle imposée par la base, message « En attente de ton équipe… »), publication impossible pour un livre écrit seul. Voir « Équipe au complet » dans `AGENTS.md`.

- [x] Retour de Juliette du 20/11 « l'IA ne détecte que très peu de fautes » : les longs textes dépassaient le délai de 8 s (aucune proposition, seuls les soulignements du navigateur restaient) et Haiku laissait passer des accords. Passage à Opus 5.5 (effort `low`), texte découpé en morceaux relus en parallèle, consigne et filtre élargis (espaces, traits d'union). Mesuré en préprod : 5/5 sur « c'est parent ne l'encourage pas… », 23 propositions sur son tour long (aucune avant). Voir « Correction » dans `AGENTS.md`.
- [x] Retour de Juliette du 20/11 « texte perdu à la déconnexion » : brouillon enregistré tout seul + copie de secours dans le navigateur, bouton « Enregistrer le brouillon » retiré. Voir « Brouillon du tour » dans `AGENTS.md`.
- [x] Retour de Juliette du 20/11 « l'âge à côté du niveau scolaire » : « CP · 6 ans » … « Terminale · 17 ans », « Adulte · 18 ans et plus », « Enfant » sans âge, dans le formulaire « Lancer un livre », les filtres (triés dans l'ordre scolaire) et la page d'un livre (« Niveau 3e, 14 ans », la virgule évitant la confusion avec les autres repères séparés par « · »). Valeurs en base inchangées ; libellés dans `src/lib/niveaux.ts`.
- [x] Retour de Juliette du 20/11 « 91 livres à rejoindre, dont certains en cours d'écriture » : les 39 livres « Commencé » de Notion (équipe formée) étaient repris comme les 52 « Lancé » sans nombre de places. La reprise leur donne maintenant `max_players` = taille de l'équipe : en préprod, 93 → 54 livres ouverts (51 repris « Lancé » + 3 nouveaux ; Juliette en voyait 91 sans les siens). Règle aussi imposée par l'action serveur et la base (migration 0013). Voir « Rejoindre un livre » dans `AGENTS.md`.
- [x] Retour de Juliette du 20/11 « le logo n'a pas la bonne typo » : l'en-tête affiche le logo complet officiel en image (`logo-co-aut-clair.png`, tiré de `logo-co-aut.png` de co-aut.com, « Co » passé du blanc à l'encre), plus de « Co-Aut » retapé en Zilla Slab. Baseline « Ensemble, soyons créatifs » : non ajoutée, à confirmer.
- [ ] Correction : la clé Claude de production doit être au nom de Co-Aut ; coût avec Opus 5.5 ~1 centime par tour court, ~5 centimes pour 1 500 caractères (avant : ~0,04 centime avec Haiku). À dire à Juliette.
- [ ] Correction, option non construite : « tout corriger » qui réécrirait aussi la ponctuation des dialogues (tirets, guillemets) et le style. Aujourd'hui l'écran de relecture applique déjà toutes les corrections d'un coup (acceptées par défaut, l'auteur rend un mot d'un geste) ; une réécriture complète contredirait la règle « ne jamais changer la voix de l'auteur » et ne serait plus vérifiable mot par mot par le filtre. À trancher avec Juliette.

- [ ] Tests de bout en bout (écrire un livre jusqu'à la publication, à plusieurs comptes).
- [ ] Retours de Juliette sur la préprod.
- [ ] Serveur de production : le VPS Infomaniak (2 Go de mémoire, aucune sauvegarde, expiration affichée au 04/12) doit recevoir l'app et la pile Supabase ; vérifier que ça tient, mettre une sauvegarde.
- [ ] Jour J : export Notion frais, migration 0006, `scripts/import-notion.py --apply`, purge des données de démo, bascule du domaine.
- [ ] Arrêt de l'ancien site (API .NET, Notion).

### Couvertures illustrées (abandonnées)

Abandonnées le 16/11 (décision de Juliette : des couleurs à la place). Les listes et la page d'un livre n'affichent que la couverture colorée composée par le code ; rien à reprendre le jour J (`cover_path` reste en base, plus lu). Plus de bouton « refaire la couverture » ni de génération automatique.

## Questions à Juliette

- (équipe au complet, 20/11) Un co-auteur quitte un livre en route : aujourd'hui l'écriture s'arrête jusqu'à ce qu'un nouveau co-auteur prenne la place (ou qu'elle baisse le nombre de places dans l'administration). Ou faut-il continuer avec ceux qui restent ?
- (équipe au complet) Équipe qui ne se complète jamais : laisser le lanceur baisser lui-même le nombre de places, ou fermer le livre au bout d'un délai ?
- (équipe au complet) Les livres « Lancé » repris de l'ancien site n'ont pas de nombre de places : ils ne sont pas concernés par la règle. Faut-il leur en fixer un ? (Les « Commencé » ont depuis le 23/11 autant de places que de co-auteurs : fermés.)

- (niveaux, 20/11) Le niveau « Enfant » (8 livres repris) n'a pas d'âge : le garder, ou le remplacer par un niveau précis ? Les libellés affichés passent à l'écriture courte (6e, 5e, 2de, 1re au lieu de 6eme, 5ème, 2nde, 1ère) : d'accord ?
- (rejoindre un livre, 23/11) Les 52 livres « Lancé » repris restent à rejoindre, dont beaucoup créés en 2024 sans aucun tour ni co-auteur : les garder visibles, ou les archiver (ou ne montrer que ceux de moins d'un an) ?

- (point du vendredi 20/11) Correction des fautes : la liste de corrections mot par mot validée par l'auteur lui suffit-elle, ou veut-elle un texte réécrit par l'IA ?

- A-t-elle accès au Bitbucket de l'ancien développeur (sources de l'ancien site) ?
- Resend ou Brevo pour les mails automatiques ?
- Lancer un livre : libre, ou validé par elle ?
- 10 livres sans statut dans Notion : repris comme archivés (invisibles), d'accord ?
- 48 demandes au code suffixé `_ANN` : bien des demandes annulées ?
