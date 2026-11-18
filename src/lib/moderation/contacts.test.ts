// Tests du repérage des coordonnées : `npm test` (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import { findContact, type ContactKind } from "./contacts.ts";

const blocked: [string, ContactKind][] = [
  // Liens
  ["Va voir https://monsite.example/page pour la suite", "lien"],
  ["regarde sur www.mon-blog.fr c'est trop bien", "lien"],
  ["mon site c'est leaecrit.com", "lien"],
  ["Mon blog : LeaEcrit.fr", "lien"],
  ["clique ici bit.ly/3xYz", "lien"],
  ["Lien : http://192.168.1.10/chat", "lien"],
  ["rejoins le serveur discord.gg/abcd", "lien"],
  // E-mails
  ["écris-moi à lea.dupont@gmail.com", "email"],
  ["Mon mail : Lea_2012@hotmail.fr", "email"],
  ["contacte moi lea @ gmail", "email"],
  ["lea arobase hotmail point fr", "email"],
  // Téléphones
  ["appelle-moi au 06 12 34 56 78", "telephone"],
  ["mon num 06.12.34.56.78 !", "telephone"],
  ["0612345678", "telephone"],
  ["tel: 06-12-34-56-78", "telephone"],
  ["+33 6 12 34 56 78", "telephone"],
  ["+33612345678", "telephone"],
  ["0033 6 12 34 56 78", "telephone"],
  ["Call me +1 (555) 123-4567", "telephone"],
  ["+44 20 7946 0958", "telephone"],
  ["mon numéro c'est 07 8 9 1 2 3 4 5 6", "telephone"],
  ["zéro six douze trente-quatre cinquante-six soixante-dix-huit", "telephone"],
  ["zero six un deux trois quatre cinq six sept huit", "telephone"],
  // Réseaux
  ["mon snap c'est lea.2012", "reseau"],
  ["Ajoute moi sur insta @lea_dupont", "reseau"],
  ["snap : leadupont", "reseau"],
  ["insta: lea.d", "reseau"],
  ["whatsapp = lea_d", "reseau"],
  ["mon discord : lea#1234", "reseau"],
  ["tiktok @lea.danse", "reseau"],
  ["telegram: @lea_d", "reseau"],
  ["suis-moi @lea_2012", "reseau"],
  ["Discord lea_2012", "reseau"],
];

const allowed = [
  "Il avait 12 ans et rêvait de partir.",
  "Le train partait à 18 h 30, il était déjà en retard.",
  "Rendez-vous à 18h30 devant la grille.",
  "Le 12/03/2024, tout bascula.",
  "C'était le 12.03.2024, un mardi.",
  "Elle est née en 1998 et lui en 2001.",
  "La guerre de 1914-1918 avait laissé des traces.",
  "Le trésor valait 1 000 000 000 de pièces d'or.",
  "Il compta 123 456 789 étoiles.",
  "Le dragon avait 3 têtes, 12 griffes et 1000 dents.",
  "Il reçut un message WhatsApp de sa mère.",
  "Elle ouvrit Snapchat sur son téléphone, puis le referma.",
  "Sur Discord, ses amis l'attendaient depuis 2019.",
  "Il avait un compte Instagram de 2019 qu'il n'utilisait plus.",
  "Le signal : attaquer à l'aube.",
  "M. Dupont regarda sa montre.",
  "Elle était là.Me voilà, dit-elle.",
  "C'était fini.De toute façon il pleuvait.",
  "Chapitre 3. Le retour.",
  "Il dit : « Zéro, c'est le nombre de fois où j'ai eu peur. »",
  "Le code du coffre était 4 8 1 5.",
  "Page 12, ligne 4, mot 7.",
  "« Arrête ! » cria Max. Tom lui répondit : « Toi, t'es qu'un idiot ! »",
  "Il était 7 h 45 et le car n'était pas là.",
  "Le numéro de sa chambre était le 214.",
  "Ils parcoururent 3 500 km en 12 jours.",
  "Le score final : 3-2.",
  "L'adresse du manoir : 12 rue des Lilas.",
  "Elle avait 06 ans, enfin 6.",
  "Elle compta : 1 2 3 4 5 6 7 8 9 10, et ouvrit les yeux.",
  "10 9 8 7 6 5 4 3 2 1 0 : décollage !",
  "Il habitait au 3 rue Haute, 75012 Paris.",
];

for (const [text, kind] of blocked) {
  test(`bloque (${kind}) : ${text}`, () => {
    const hit = findContact(text);
    assert.ok(hit, "rien repéré");
    assert.equal(hit.kind, kind);
  });
}

for (const text of allowed) {
  test(`laisse passer : ${text}`, () => {
    assert.equal(findContact(text), null);
  });
}
