# Reprise de l'ancienne base Notion

L'ancien site co-aut.com stocke tout dans Notion (base « Bdd - prod » : Joueurs, Livres, Tours d'écriture, Demandes de participation). `scripts/import-notion.py` reprend un export de cette base dans notre modèle. Il est rejouable : le jour de la mise en ligne, on refait un export frais et on relance.

## Le jour J

1. Notion → « Bdd - prod » → Exporter : **Markdown & CSV**, tout le contenu, **sous-pages incluses**. On obtient un zip (ne jamais le commiter : données personnelles, dont des mineurs).
2. Migration, une fois (rejouable) : `docker exec -i coaut-db psql -U postgres -d postgres < supabase/migrations/0006_reprise_notion.sql`
3. Essai à blanc (tout est exécuté puis annulé), puis import réel :

```bash
export COAUT_PSQL='ssh -J ubuntu@54.38.69.101 turing@192.168.200.10 docker exec -i coaut-db psql -U postgres -d postgres'
python3 scripts/import-notion.py export-notion.zip --dry-run
python3 scripts/import-notion.py export-notion.zip --apply
```

Python 3 seul, aucune dépendance. `COAUT_PSQL` = n'importe quelle commande psql qui lit le SQL sur son entrée standard. Sans `--dry-run` ni `--apply`, le script analyse l'export sans toucher à la base. `--details` liste les lignes écartées.

Tout passe dans une seule transaction : en cas d'erreur, rien n'est écrit. Un deuxième passage avec le même export ne change rien (tous les compteurs à 0). Garde-fou : le script refuse de tourner si des tours ont été écrits sur le nouveau site après la date de l'export (`--force` pour passer outre), car il réécrit les tours repris.

## Correspondance

Clé stable partout : l'identifiant de la page Notion, rangé dans `legacy_id` (c'est aussi l'`id` que renvoyait l'ancienne API, donc les 448 tours déjà en base sont retrouvés et mis à jour, pas doublés).

| Notion | Chez nous |
|---|---|
| Joueurs · Pseudo, Date de création | `authors.nickname`, `created_at` |
| Joueurs · E-mail | `auth.users.email` (compte créé sans mot de passe) |
| Joueurs · Prénom, Nom, Date de naissance, Niveau scolaire, Ville, Pays, Professionnel, Accepte communications commerciales, note libre de la fiche | `author_profiles` (table privée, nouvelle) |
| Livres · Code, Titre, Synopsis, Thème(s), Niveau scolaire, Lanceur, Date | `books` (`legacy_code`, `title`, `synopsis`, `themes`, `scolar_level`, `launcher_id`, `created_at`) |
| Livres · Statut | Lancé et Commencé → `launched`, Publié → `published`, vide → `archived` (nouveau, invisible sur le site). Commencé = équipe formée en cours d'écriture : `max_players` = taille de l'équipe, le livre n'est plus à rejoindre (Lancé : `max_players` null, ouvert) |
| Livres · Joueurs | `book_players` ; l'ordre de passage est reconstruit depuis les tours |
| Tours · Livre, Numéro, Joueur, Terminé, Validé, Date de création, texte de la page | `turns` |
| Demandes · Code livre, Pseudo joueur, Statut, Date | `join_requests` |

Non repris, volontairement :

- Colonnes en double ou calculées : `Mailing List`, `Est professionnel`, `Date`, `Joueurs.Nombre`, `Tours.Nombre`, `Tours.Nombre!`, `Lanceur.Email`, `Lanceur.Pseudo`, `Joueurs.Pseudo`, `Livre.Code`, `Livre.Titre`, `Joueur.Pseudo`, `Créée par`.
- `Fichier` (livres) et `Code` (demandes) : vides partout.
- `Relance J+10` et `Saut de tour` (tours) : dates de l'ancienne automatisation de relance, recalculables depuis la date du tour.
- La page « Suggestions de matching co-auteurs » : une note rédigée à la main, pas une donnée.
- Les crayons ✏️ à la fin des pseudos sont gardés tels quels (c'est l'identité de l'auteur dans l'ancien site).

Écarté parce que la ligne ne se rattache plus à rien dans Notion (les compteurs s'affichent à chaque passage) : tours dont le livre a été supprimé, demandes sur un livre ou d'un joueur supprimé, demandes au code suffixé `_ANN`, fiches de livre vides, doublons.

## Comptes

Chaque joueur devient un compte `auth.users` à l'e-mail confirmé et **sans mot de passe** : la connexion par mot de passe est refusée tant que l'auteur n'en a pas choisi un par un lien de réinitialisation. Les comptes sont insérés en SQL, GoTrue n'est pas appelé : aucun mail ne part. Un compte qui existe déjà avec le même e-mail est laissé tel quel.

À prévoir avant l'ouverture : une page « mot de passe oublié » dans l'app et un SMTP sur GoTrue (aucun des deux n'existe aujourd'hui), sinon les anciens auteurs ne peuvent pas entrer.

Si un compte existant est déjà relié à un autre pseudo (compte de démo), l'auteur Notion est repris sans compte et le script l'affiche en `CONFLIT`.
