import { test } from "node:test";
import assert from "node:assert/strict";
import { decouper } from "./decoupe.ts";

test("découpe par paragraphes entiers, positions exactes", () => {
  const p = "Une phrase assez longue pour remplir.\n\n";
  const texte = p.repeat(30) + "Fin.";
  const morceaux = decouper(texte, 200);
  assert.ok(morceaux.length > 1);
  for (const m of morceaux) assert.equal(texte.slice(m.debut, m.debut + m.texte.length), m.texte);
  assert.equal(morceaux.map((m) => m.texte).join(""), texte);
  assert.ok(morceaux.every((m) => m.texte.length <= 200 || !m.texte.slice(0, -1).includes("\n")));
});

test("texte court : un seul morceau", () => {
  assert.deepEqual(decouper("Bonjour.", 700), [{ debut: 0, texte: "Bonjour." }]);
});

test("long paragraphe sans retour à la ligne : coupé en fin de phrase", () => {
  const texte = "Il marchait dans la forêt sombre. ".repeat(40).trim();
  const morceaux = decouper(texte, 300);
  assert.ok(morceaux.length > 3);
  assert.equal(morceaux.map((m) => m.texte).join(""), texte);
  for (const m of morceaux) assert.match(m.texte, /^Il marchait/);
});
