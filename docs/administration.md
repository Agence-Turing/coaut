# Administration (Juliette)

Validé par Toni le 18/11. Principe : le plus pratique possible, sans complication, mais Juliette peut tout faire. Le site tourne sans elle : aucune file de validation, aucune action obligatoire de sa part.

Accès : `/admin`, réservé aux comptes administrateurs (celui de Juliette, rattaché à son profil d'auteur, plus Toni pour les tests). Quatre pages bâties pareil : un tableau, des filtres au-dessus, des actions par ligne ou sur plusieurs lignes cochées.

## Livres
- Colonnes : code, titre, statut, lanceur, co-auteurs, tours, dernier tour, à qui le tour (depuis X jours), public / classe.
- Filtres : recherche, statut, sans tour depuis plus de 30 jours, public / classe.
- Actions : modifier titre et résumé, archiver, publier, changer le nombre de co-auteurs, retirer ou ajouter un co-auteur (dont elle-même, pour reprendre un livre abandonné), passer le tour, supprimer.

## Auteurs
- Colonnes : pseudo, prénom et nom, e-mail, âge, ville, pro, newsletter, inscrit le, dernier tour, bloqué.
- Filtres : recherche, tranche d'âge, pro, newsletter, bloqué.
- Actions : changer le pseudo, voir ses livres et ses tours, note interne (`admin_note`), bloquer, supprimer, export CSV.

## Tours
- Colonnes : livre, numéro, auteur, date, début du texte, « Bloqué par l'IA » (vide tant que la modération IA n'existe pas).
- Filtres : livre, auteur, bloqué.
- Actions : lire en entier, modifier le texte, supprimer.

## Classes (après le lot livres privés élèves)
- Colonnes : classe, prof (et son e-mail), nombre d'élèves, livres, créée le.
- Filtres : recherche.
- Actions : voir les élèves et leurs codes, bloquer le prof ou la classe, supprimer.

Hors périmètre : statistiques, édition des textes des mails, synchronisation Brevo (chantier à part).
