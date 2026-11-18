# Livres privés pour les élèves (classes)

Demandé par Juliette à la démo du 16/11 : un enseignant ou un professionnel qui travaille avec des enfants (école, orthophoniste, psy…) crée un livre où seuls ses élèves écrivent. Les enfants n'ont ni e-mail ni téléphone, et un code commun à la classe ne marche pas : un élève écrirait à la place d'un autre (c'est arrivé à l'école EDI). Donc **un code personnel par élève**. Hors devis D-2026-1121, non facturé.

Aujourd'hui, les élèves se connectent avec le compte de l'enseignant : ils voient son e-mail et l'enseignant reçoit toutes les notifications.

## Ce que ça change sur le site

### 1. Le compte « professionnel »

- À l'inscription ou dans « Mon profil » : case « Je suis enseignant ou professionnel et j'écris avec des enfants », avec l'établissement ou la structure.
- Pas de validation : le professionnel s'inscrit en autonomie et le menu « Mes classes » apparaît tout de suite (décision de Toni, 18/11). Le risque reste limité : les élèves d'une classe n'écrivent que dans les livres de cette classe. Juliette voit les comptes pros dans l'administration et peut les bloquer.

### 2. « Mes classes » (côté professionnel)

Une classe = un groupe d'élèves, réutilisable pour plusieurs livres.

```
Mes classes                                  [+ Créer une classe]
┌──────────────────────────────────────────────────────────────┐
│ CM1 — École Jules Ferry        28 élèves     2 livres en cours │
│ Atelier mercredi               6 élèves      1 livre publié    │
└──────────────────────────────────────────────────────────────┘
```

Créer une classe : un nom, puis les prénoms des élèves (un par ligne, ou un nombre d'élèves si le prof préfère « Élève 1, 2… »). Pas de nom de famille. Le site génère un code par élève :

```
CM1 — École Jules Ferry                  [Imprimer les codes]
  Prénom      Code            Tours écrits
  André       LOUTRE-2510     3            [Nouveau code] [Retirer]
  Robert      COMETE-8841     2            [Nouveau code] [Retirer]
  …
```

- Code = un mot simple + 4 chiffres, facile à recopier pour un enfant, impossible à deviner (tentatives limitées).
- « Imprimer les codes » : une page A4 d'étiquettes à découper (prénom, code, adresse co-aut.com/classe) à coller dans le cahier de liaison.
- Code perdu : « Nouveau code », l'ancien ne marche plus. Les tours déjà écrits restent au nom de l'élève.

### 3. Lancer un livre privé

Dans « Lancer un livre », le professionnel voit un choix en plus : **Public** (comme aujourd'hui) ou **Réservé à ma classe** (+ choix de la classe).

- Pas de demandes à rejoindre : les élèves de la classe sont dans l'équipe d'office. Le prof règle l'ordre de passage (glisser-déposer, ou au hasard) et peut passer le tour d'un absent.
- Le livre n'apparaît pas dans « Rejoindre un livre ». Une fois publié, il est visible de tous dans la bibliothèque publique.
- Validation : le prof peut relire chaque tour avant qu'il soit ajouté (classes d'enfants dyslexiques), en plus du contrôle par IA prévu.

### 4. Le côté élève

Une page dédiée, **co-aut.com/classe**, avec un seul grand champ « Ton code ».

```
        Co-Aut — Espace classe
   ┌─────────────────────────────┐
   │  Ton code : LOUTRE-2510     │
   └─────────────────────────────┘
            [ J'entre ]
```

Une fois entré, l'élève voit uniquement les livres de sa classe, avec « C'est à toi d'écrire ! » sur le bon livre. Il lit le livre, écrit son tour, c'est tout : pas d'accès aux livres publics, pas de demande à rejoindre, pas de profil, pas de mail. Son nom affiché sur ses tours = son prénom.

### 5. Notifications

Les élèves n'ont pas d'e-mail : pas de « à ton tour » ni de relances pour eux. L'élève le voit en se connectant, et le prof reçoit **un seul mail récapitulatif par jour** (qui a écrit, à qui c'est le tour), jamais un mail par action. Fini les 30 mails à 21 h 30.

## Technique (pour mémoire)

- Tables `classes` (professionnel propriétaire, nom) et `class_students` (classe, prénom, code haché, actif) ; `authors.kind` = `adult` / `student` ; `books.class_id` (null = public) ; `books.validation` pour la relecture par le prof.
- Connexion élève : une action serveur vérifie le code (limite de tentatives par IP) et ouvre une session Supabase sur un compte technique de l'élève (e-mail factice non routable, jamais affiché). Nouveau code = nouveau mot de passe de ce compte.
- RLS : un élève ne lit et n'écrit que les livres de sa classe ; un livre de classe n'est lisible que par la classe et son prof tant qu'il n'est pas publié en public.
- Cron des relances et mails « à ton tour » : ignorer les auteurs `student`, ajouter le récap quotidien du prof.

## Décisions (Toni, 18/11)

- Un élève ne voit que les livres de sa classe, rien d'autre (pas de bibliothèque publique).
- Un livre de classe publié est visible de tous dans la bibliothèque publique.
- Le code d'un élève reste valable tant qu'il a un livre de sa classe encore ouvert (ou que la classe n'a pas encore de livre) ; quand tous les livres de la classe sont publiés ou archivés, le code ne marche plus (message « Ton livre est terminé »). Le prof peut relancer un livre pour la même classe, ce qui réactive les codes.
- Lot non facturé (geste commercial).
