# Administration (Juliette)

Validé par Toni le 18/11. Principe : le plus pratique possible, sans complication, mais Juliette peut tout faire. Le site tourne sans elle : aucune file de validation, aucune action obligatoire de sa part.

Accès : `/admin`, réservé aux comptes administrateurs (celui de Juliette, rattaché à son profil d'auteur, plus Toni pour les tests). Quatre pages bâties pareil : un tableau, des filtres au-dessus, des actions par ligne ou sur plusieurs lignes cochées.

## Livres
- Colonnes : code, titre, statut, lanceur, co-auteurs, tours, dernier tour, à qui le tour (depuis X jours), public / classe.
- Filtres : recherche, statut, sans tour depuis plus de 30 jours, public / classe.
- Actions : modifier titre et résumé, archiver, publier, changer le nombre de co-auteurs, retirer ou ajouter un co-auteur (dont elle-même, pour reprendre un livre abandonné), passer le tour, supprimer.
- Faire d'un co-auteur le lanceur (réunion du 24/11, livre public) : bouton « Faire lanceur » dans l'équipe, sur la fiche du livre. Pour un lanceur parti : un autre co-auteur reprend le livre, reçoit les demandes pour rejoindre (et leurs mails, y compris celles déjà en attente), publie et règle le nombre de places. Le nouveau lanceur doit être dans l'équipe (l'ajouter d'abord). À qui le tour ne change pas.

## Auteurs
- Colonnes : pseudo, prénom et nom, e-mail, âge, ville, pro, newsletter, inscrit le, dernier tour, bloqué.
- Filtres : recherche, tranche d'âge, pro, newsletter, bloqué.
- Actions : changer le pseudo, voir ses livres et ses tours, note interne (`admin_note`), bloquer, supprimer, export CSV.

## Tours
- Colonnes : livre, numéro, auteur, date, début du texte, « Bloqué par l'IA » (vide tant que la modération IA n'existe pas).
- Filtres : livre, auteur, bloqué ; « Afficher : Tours en retard » (réunion du 24/11) : les livres en cours dont le tour n'a pas avancé depuis 15 jours ou plus (seuil modifiable dans le filtre), avec l'auteur dont c'est le tour, la date, son brouillon éventuel et « Passer le tour ».
- Actions : lire en entier, modifier le texte, supprimer.

## Classes (après le lot livres privés élèves)
- Colonnes : classe, prof (et son e-mail), nombre d'élèves, livres, créée le.
- Filtres : recherche.
- Actions : voir les élèves et leurs codes, bloquer le prof ou la classe, supprimer.

Hors périmètre : statistiques, édition des textes des mails, synchronisation Brevo (chantier à part).

Le lanceur, de son côté (page de son livre en cours, bloc « Ton livre », réunion du 24/11) : il change le nombre de co-auteurs de son livre public (2 à 10, jamais moins que son équipe) et annule son livre tant que personne n'a écrit. Il ne peut pas changer de lanceur : c'est l'administration.
