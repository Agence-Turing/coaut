/**
 * Jeu d'essai de la correction des fautes contre l'IA réelle (~1 centime par texte).
 *
 *   ANTHROPIC_API_KEY=… npm run essai-correction
 *
 * Passe chaque texte inventé (pièges : homophones, participes, noms inventés,
 * onomatopées, langage parlé, texte sans faute) dans `corrigerTour`, comme à
 * l'envoi d'un tour, et affiche ce qui est corrigé, rejeté par le filtre, et le
 * texte reconstruit. Code retour 1 si une correction acceptée touche un passage
 * listé comme intouchable. Les tours réels de la préprod ne sont pas recopiés ici.
 */
import { corrigerTour } from "../src/lib/correction/index.ts";
import { appliquer } from "../src/lib/correction/filtre.ts";

type Cas = { nom: string; texte: string; tours?: string[]; intouchables?: string[] };

const CAS: Cas[] = [
  {
    nom: "enfant, répétition voulue",
    texte:
      "Le chevalier a pris son épée et il est partit a la chasse au dragon. Ses amis l'on suivi. Il fesait très froid et ils avaient peur, très très peur.",
    intouchables: ["très très peur"],
  },
  {
    nom: "homophones",
    texte:
      "Sa va être dur, dit Tom. Ces la première fois que je voi un fantôme. Ou est ta lampe ? On a oublier les sandwich.",
  },
  {
    nom: "participes passés",
    texte:
      "Les fleurs que j'ai cueilli étaient fanées. Elle s'est lavé les mains puis elles sont partis au marché avec leur panier.",
  },
  {
    nom: "noms et mots inventés",
    texte:
      "Brouchtak le zorgnif sauta sur le Glimbouk. — Gloubi-boulga ! cria Zinzolin. Les zorgnifs sont toujours affamé.",
    tours: [
      "Dans la vallée vivaient les zorgnifs, petites bêtes à poils bleus. Le plus courageux s'appelait Brouchtak.",
    ],
    intouchables: ["Brouchtak", "zorgnif", "Glimbouk", "Gloubi-boulga", "Zinzolin"],
  },
  {
    nom: "onomatopées",
    texte:
      "Boum ! Splatch ! Aaaaaah ! La porte explosa. Vrouuum, la moto démare et s'enfuit dans la nuit.",
    intouchables: ["Boum", "Splatch", "Aaaaaah", "Vrouuum"],
  },
  {
    nom: "adulte, sans faute",
    texte:
      "Le vent soufflait sur la lande. Marguerite referma la porte derrière elle et alluma la lampe à huile. Personne ne viendrait ce soir, elle le savait.",
    intouchables: ["Le vent soufflait sur la lande."],
  },
  {
    nom: "adulte, fautes fines",
    texte:
      "Quoiqu'il en soit, nous nous sommes rendus compte trop tard que la clé avait disparue. Malgré qu'il pleuvait, nous sommes sortis la chercher.",
  },
  {
    nom: "enfant, écriture phonétique",
    texte:
      "kan je suis arivé a lécole, la mètresse ma dit que javé oublié mon cartable. Jétait tres triste.",
  },
  {
    nom: "dialogue en langage parlé",
    texte:
      "— T'as vu ça ? Ch'uis sûr que c'est un ovni ! — Ouais, trop bien, on y va ? — Grave, mais faut pas le dire à ma daronne.",
    intouchables: ["T'as", "Ch'uis", "faut pas", "daronne"],
  },
  {
    nom: "tournures d'enfant",
    texte:
      "Le loup il est méchant. Le loup il mange les moutons. Et après il dort. Et après il se réveille et il a encore faim.",
    intouchables: ["Le loup il", "Et après il"],
  },
  {
    nom: "mot propre au livre",
    texte:
      "Les grouillons sortirent du terrier. Un grouillon plus petit que les autre s'approcha de Lili.",
    tours: ["Sous la colline vivaient des grouillons, des sortes de taupes qui parlent."],
    intouchables: ["grouillon"],
  },
];

let ecarts = 0;
let entree = 0;
let sortie = 0;
const durees: number[] = [];

for (const c of CAS) {
  const r = await corrigerTour(c.texte, { tours: c.tours });
  if (r.usage) {
    entree += r.usage.entree;
    sortie += r.usage.sortie;
  }
  if (r.dureeMs) durees.push(r.dureeMs);
  const corrige = appliquer(c.texte, r.corrections);
  const touches = (c.intouchables ?? []).filter(
    (m) => c.texte.includes(m) && !corrige.includes(m)
  );
  if (touches.length) ecarts++;
  console.log(`\n## ${c.nom} ${r.verifie ? `(${r.dureeMs} ms)` : "(PAS DE RÉPONSE)"}`);
  console.log(
    `  corrigé : ${r.corrections.map((x) => `${x.avant} → ${x.apres} [${x.type}]`).join(" ; ") || "rien"}`
  );
  if (r.rejets.length)
    console.log(
      `  rejeté  : ${r.rejets.map((x) => `${x.proposition.fautif} → ${x.proposition.correction} (${x.raison})`).join(" ; ")}`
    );
  console.log(`  texte   : ${corrige}`);
  if (touches.length) console.log(`  ÉCART : passage intouchable modifié : ${touches.join(", ")}`);
}

durees.sort((a, b) => a - b);
const cout = (entree * 4 + sortie * 20) / 1e6; // Opus 5.5 : 4 $ / 20 $ par million
console.log(
  `\n${CAS.length} textes, ${ecarts} écart(s). Jetons : ${entree} en entrée, ${sortie} en sortie (~${((cout / CAS.length) * 100).toFixed(3)} centime de dollar par texte). Durée médiane ${durees[Math.floor(durees.length / 2)] ?? "-"} ms, max ${durees.at(-1) ?? "-"} ms.`
);
process.exit(ecarts ? 1 : 0);
