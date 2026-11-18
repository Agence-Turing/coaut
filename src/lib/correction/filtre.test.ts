// Tests du filtre de correction : `npm test` (node --test, sans dépendance).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appliquer,
  cle,
  filtrer,
  raisonDeRejet,
  verifierReconstruction,
  type Proposition,
} from "./filtre.ts";

const p = (
  fautif: string,
  correction: string,
  type: Proposition["type"] = "orthographe",
  extrait = ""
): Proposition => ({ extrait, fautif, correction, type });

test("clé phonétique : homophones et graphies d'enfants", () => {
  const paires = [
    ["a", "à"],
    ["ses", "ces"],
    ["et", "est"],
    ["on", "ont"],
    ["son", "sont"],
    ["ou", "où"],
    ["sa", "ça"],
    ["peu", "peut"],
    ["c'est", "ces"],
    ["mangé", "manger"],
    ["mangeait", "mangé"],
    ["mangent", "mange"],
    ["bocou", "beaucoup"],
    ["kan", "quand"],
    ["otomobile", "automobile"],
  ];
  for (const [a, b] of paires) assert.equal(cle(a), cle(b), `${a} / ${b}`);
  assert.notEqual(cle("porte"), cle("port"));
  assert.notEqual(cle("content"), cle("heureux"));
});

test("accepte les vraies corrections", () => {
  const ok: [string, string][] = [
    ["a", "à"],
    ["ses", "ces"],
    ["sa", "ça"],
    ["bocou", "beaucoup"],
    ["kan", "quand"],
    ["maisno", "maison"],
    ["petit", "petite"],
    ["le", "la"],
    ["il mangent", "ils mangent"],
    ["c est", "c'est"],
    ["parceque", "parce que"],
    ["chevaus", "chevaux"],
    ["paris", "Paris"],
    ["mangé", "manger"],
    ["fini", "finit"],
    ["fesait", "faisait"],
    ["bonhom", "bonhomme"],
  ];
  for (const [a, b] of ok) assert.equal(raisonDeRejet(a, b), null, `${a} → ${b}`);
});

test("rejette les réécritures et les changements de mots", () => {
  const ko: [string, string][] = [
    ["très content", "ravi"],
    ["grand", "immense"],
    ["dit", "déclara"],
    ["il", "elle"],
    ["mon", "ton"],
    ["maison", "demeure"],
    ["il était une fois", "il était autrefois"],
    ["le chat noir", "le chat sombre"],
    ["chat", "chien"],
    ["3", "trois"],
    ["Boum", "Bom"],
    ["Aaaah", "Ah"],
    ["il", ""],
    ["très", " "],
    ["", "très"],
    ["!", "très !"],
  ];
  for (const [a, b] of ko) assert.notEqual(raisonDeRejet(a, b), null, `${a} → ${b}`);
});

test("une IA qui triche en reformulant est rejetée, le texte reste intact", () => {
  const texte =
    "Le dragon était très content. Il a mangé bocou de gateaux et il a dit merci.";
  const triche = [
    p("très content", "fou de joie", "orthographe", "était très content"),
    p("Le dragon était très content.", "Le dragon rayonnait de bonheur.", "ponctuation"),
    p("il a dit merci", "il remercia", "conjugaison"),
    p("a dit", "déclara", "conjugaison", "il a dit merci"),
    p("bocou", "beaucoup", "orthographe", "mangé bocou de"),
    p("gateaux", "gâteaux", "orthographe", "de gateaux et"),
  ];
  const { corrections, rejets } = filtrer(texte, triche);
  assert.deepEqual(
    corrections.map((c) => `${c.avant}→${c.apres}`),
    ["bocou→beaucoup", "gateaux→gâteaux"]
  );
  assert.equal(rejets.length, 4);
  assert.equal(
    appliquer(texte, corrections),
    "Le dragon était très content. Il a mangé beaucoup de gâteaux et il a dit merci."
  );
});

test("passage introuvable ou ambigu : rejeté", () => {
  const texte = "Il a un chat. Il a un chien.";
  const { corrections, rejets } = filtrer(texte, [
    p("chiat", "chat"),
    p("a", "à", "homophone"), // deux « a » sans extrait
  ]);
  assert.equal(corrections.length, 0);
  assert.deepEqual(
    rejets.map((r) => r.raison),
    ["passage introuvable", "passage ambigu"]
  );
});

test("l'extrait situe le bon mot parmi plusieurs", () => {
  const texte = "Il a un vélo. Il va a la plage.";
  const { corrections } = filtrer(texte, [p("a", "à", "homophone", "va a la plage")]);
  assert.equal(corrections.length, 1);
  assert.equal(appliquer(texte, corrections), "Il a un vélo. Il va à la plage.");
});

test("même faute dans le même extrait à deux endroits : corrigée deux fois", () => {
  const texte = "Il va a la plage. Puis il va a la plage.";
  const { corrections } = filtrer(texte, [p("a", "à", "homophone", "va a la")]);
  assert.equal(appliquer(texte, corrections), "Il va à la plage. Puis il va à la plage.");
});

test("ne corrige pas une partie de mot", () => {
  const texte = "La patate est cuite.";
  const { corrections } = filtrer(texte, [p("pat", "patte")]);
  assert.equal(corrections.length, 0);
});

test("noms propres et vocabulaire du livre protégés", () => {
  const texte = "Le Zorglub regarde Mirabella. Le bonhom crie : zorglubi !";
  const { corrections, rejets } = filtrer(
    texte,
    [
      p("Zorglub", "Zorglube", "orthographe", "Le Zorglub regarde"),
      p("Mirabella", "Mirabelle", "orthographe"),
      p("zorglubi", "zorglub", "orthographe"),
      p("bonhom", "bonhomme", "orthographe"),
    ],
    { lexique: ["zorglubi"] }
  );
  assert.deepEqual(corrections.map((c) => c.apres), ["bonhomme"]);
  assert.deepEqual(
    rejets.map((r) => r.raison),
    ["nom propre", "nom propre", "mot déjà présent dans le livre"]
  );
});

test("majuscule en début de phrase : corrigeable", () => {
  const texte = "Il pleut. Mais Tom sort. — Bonjour dit Tom.";
  const { corrections } = filtrer(texte, [p("Mais", "mais"), p("Bonjour", "Bonjour,", "ponctuation")]);
  // « Mais » est en début de phrase : accepté ; « Bonjour » aussi (après un tiret).
  assert.equal(corrections.length, 2);
});

test("l'auteur garde sa version d'un mot", () => {
  const texte = "Sa va bien, je mange une pome.";
  const { corrections } = filtrer(texte, [
    p("Sa", "Ça", "homophone", "Sa va bien"),
    p("pome", "pomme"),
  ]);
  assert.equal(corrections.length, 2);
  assert.equal(appliquer(texte, corrections), "Ça va bien, je mange une pomme.");
  assert.equal(appliquer(texte, corrections, new Set([0])), "Sa va bien, je mange une pomme.");
});

test("vérification de la reconstruction", () => {
  const texte = "un chat noir";
  const corrections = [{ debut: 3, fin: 7, avant: "chat", apres: "chats", type: "accord" as const }];
  assert.ok(verifierReconstruction(texte, "un chats noir", corrections));
  assert.ok(verifierReconstruction(texte, "un chat noir", corrections));
  assert.ok(!verifierReconstruction(texte, "un chats sombre", corrections));
  assert.ok(!verifierReconstruction(texte, "deux chats noir", corrections));
});

test("propositions mal formées ou chevauchantes", () => {
  const texte = "Les enfant joue.";
  const { corrections, rejets } = filtrer(texte, [
    // @ts-expect-error type inconnu volontaire
    p("joue", "jouent", "style"),
    p("enfant", "enfants", "accord"),
    p("enfant joue", "enfants jouent", "accord"),
    p("joue", "jouent", "accord"),
  ]);
  assert.equal(appliquer(texte, corrections), "Les enfants jouent.");
  assert.ok(rejets.some((r) => r.raison === "type inconnu"));
  assert.ok(rejets.some((r) => r.raison === "chevauche une autre correction"));
});
