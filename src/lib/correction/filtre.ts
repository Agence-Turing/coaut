/**
 * Correction des fautes : le filtre.
 *
 * L'IA ne renvoie jamais le texte, seulement des propositions (passage fautif,
 * correction, type). Ce module, pur et sans dépendance (testé par
 * `filtre.test.ts`, utilisé côté serveur et côté navigateur), décide lesquelles
 * sont acceptables, les place dans le texte et reconstruit le texte corrigé.
 * Une proposition est rejetée dès qu'elle ressemble à une réécriture :
 * plus de deux mots, mot remplacé par un autre mot, passage introuvable,
 * nom propre ou mot inventé, onomatopée.
 */

export const TYPES_CORRECTION = [
  "orthographe",
  "accord",
  "conjugaison",
  "homophone",
  "ponctuation",
  "majuscule",
] as const;
export type TypeCorrection = (typeof TYPES_CORRECTION)[number];

/** Ce que l'IA propose. */
export type Proposition = {
  /** Courte citation exacte du texte qui contient le passage fautif. */
  extrait: string;
  /** Le passage fautif exact (un ou deux mots). */
  fautif: string;
  /** Sa graphie corrigée. */
  correction: string;
  type: TypeCorrection;
};

/** Une correction acceptée et placée dans le texte (indices en unités JS). */
export type Correction = {
  debut: number;
  fin: number;
  avant: string;
  apres: string;
  type: TypeCorrection;
};

export type Rejet = { proposition: Proposition; raison: string };

export type ContexteLivre = {
  /** Mots déjà présents ailleurs dans le livre (titre, résumé, autres tours), en minuscules. */
  lexique?: Iterable<string>;
};

/* ------------------------------------------------------------------ */
/* Outils sur les mots                                                 */
/* ------------------------------------------------------------------ */

const LETTRE = /[\p{L}\p{N}]/u;
const APOSTROPHES = /[’ʼ`]/g;

/** Nombre de mots (suites contenant au moins une lettre ou un chiffre). */
export function nombreDeMots(s: string): number {
  return s.split(/\s+/).filter((m) => LETTRE.test(m)).length;
}

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Squelette : minuscules, sans accents, sans ponctuation ni espaces. */
export function squelette(s: string): string {
  return sansAccents(s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")).replace(
    /[^\p{L}\p{N}]/gu,
    ""
  );
}

/** La ponctuation seule d'un passage. */
function ponctuation(s: string): string {
  return s.replace(/[\p{L}\p{N}\s]/gu, "").replace(APOSTROPHES, "'");
}

/** Distance d'édition avec transpositions (Damerau restreinte). */
export function distance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[n][m];
}

/**
 * Clé phonétique simplifiée du français : deux graphies qui se prononcent
 * pareil (a/à, ses/ces, mangé/manger/mangeait, bocou/beaucoup) ont la même clé.
 * Volontairement approximative : elle sert à reconnaître une graphie corrigée,
 * pas à prononcer.
 */
export function cle(mot: string): string {
  let s = mot
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/ç/g, "s")
    .replace(/[éèêë]/g, "E");
  s = sansAccents(s).replace(/[^a-zE]/g, "");
  if (!s) return "";
  // Petits mots en -es / -est (les, ces, ses, est, c'est) : son « é ».
  if (s.length <= 4) s = s.replace(/es$|est$/, "E");
  s = s.replace(/^fais(?=[aeiouE])/, "fes"); // faisait se dit « fesait »
  s = s
    .replace(/ent$/, s.length > 4 ? "e" : "ent") // ils mangent = il mange
    .replace(/(er|ez|et)$/, "E")
    .replace(/sch/g, "X")
    .replace(/ch/g, "X")
    .replace(/ph/g, "f")
    .replace(/qu/g, "k")
    .replace(/q/g, "k")
    .replace(/gu(?=[eiyE])/g, "g")
    .replace(/g(?=[eiyE])/g, "j")
    .replace(/je(?=[aou])/g, "j")
    .replace(/c(?=[eiyE])/g, "s")
    .replace(/ck/g, "k")
    .replace(/c/g, "k")
    .replace(/h/g, "")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/z/g, "s")
    .replace(/x$/, "")
    .replace(/x/g, "ks")
    .replace(/([bcdfgjklmnprstvX])\1+/g, "$1")
    .replace(/eau/g, "o")
    .replace(/au/g, "o")
    .replace(/(ain|ein|aim|eim)(?![aeiouEmn])/g, "1")
    .replace(/(in|im|un|um)(?![aeiouEmn])/g, "1")
    .replace(/(an|am|en|em)(?![aeiouEmn])/g, "2")
    .replace(/(on|om)(?![aeiouEmn])/g, "3")
    .replace(/oi/g, "wa")
    .replace(/ou/g, "U")
    .replace(/eu/g, "9")
    .replace(/oe/g, "9")
    .replace(/(ai|ei)/g, "E");
  // Consonnes muettes finales, puis e muet final.
  s = s.replace(/[stdxp]+$/, "");
  if (s.length > 1) s = s.replace(/e$/, "");
  return s.replace(/(.)\1+/g, "$1");
}

/** Terminaisons d'accord et de conjugaison (sur le squelette, sans accents). */
const TERMINAISONS = new Set([
  "", "e", "s", "es", "x", "t", "nt", "ent", "ee", "ees", "er", "ez", "ons",
  "ai", "ais", "ait", "aient", "a", "as", "i", "is", "it", "ie", "ies",
  "u", "us", "ue", "ues", "al", "aux", "eau", "eaux", "il", "ils",
]);

/** Mots-outils qui s'accordent entre eux (« le maison » → « la maison »). */
const FAMILLES = [
  ["le", "la", "les", "l"],
  ["un", "une", "des"],
  ["ce", "cet", "cette", "ces"],
  ["mon", "ma", "mes"],
  ["ton", "ta", "tes"],
  ["son", "sa", "ses"],
  ["notre", "nos"],
  ["votre", "vos"],
  ["leur", "leurs"],
  ["du", "de", "des", "d"],
  ["au", "aux", "a"],
  ["il", "ils"],
  ["elle", "elles"],
  ["quel", "quelle", "quels", "quelles"],
  ["tout", "toute", "tous", "toutes"],
  ["beau", "bel", "belle", "beaux", "belles"],
  ["nouveau", "nouvel", "nouvelle", "nouveaux", "nouvelles"],
  ["vieux", "vieil", "vieille", "vieilles"],
];

function memeFamille(a: string, b: string): boolean {
  return FAMILLES.some((f) => f.includes(a) && f.includes(b));
}

function memeRacine(a: string, b: string): boolean {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p < 3) return false;
  return TERMINAISONS.has(a.slice(p)) && TERMINAISONS.has(b.slice(p));
}

/** Deux mots (squelettes) sont-ils deux graphies du même mot ? */
function memeMot(a: string, b: string, brutA: string, brutB: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const ka = cle(brutA);
  if (ka && ka === cle(brutB)) return true;
  if (memeFamille(a, b) || memeRacine(a, b)) return true;
  const L = Math.max(a.length, b.length);
  const d = distance(a, b);
  if (L >= 5 && d <= 1) return true; // faute de frappe
  if (L >= 8 && d <= 2) return true;
  return false;
}

/**
 * Raison du rejet d'un remplacement `avant` → `apres`, ou null s'il est
 * acceptable (une graphie corrigée, pas un autre mot).
 */
export function raisonDeRejet(avant: string, apres: string): string | null {
  if (!avant.trim()) return "passage vide";
  if (avant === apres) return "aucun changement";
  const na = nombreDeMots(avant);
  const nb = nombreDeMots(apres);
  if (na !== nb && (na === 0 || nb === 0)) return "ajout ou suppression de mots";
  if (na === 0) {
    // Ponctuation seule : tolérée si légère.
    return distance(ponctuation(avant), ponctuation(apres)) <= 1 && !LETTRE.test(apres)
      ? null
      : "ajout ou suppression de mots";
  }
  if (na > 2 || nb > 2) return "plus de deux mots";
  if (distance(ponctuation(avant), ponctuation(apres)) > 2) return "ponctuation trop modifiée";
  const sa = squelette(avant);
  const sb = squelette(apres);
  if (sa === sb) return null; // accents, majuscules, apostrophes, espaces
  if (/(\p{L})\1\1/iu.test(avant)) return "onomatopée";

  const motsA = avant.split(/\s+/).filter((m) => LETTRE.test(m));
  const motsB = apres.split(/\s+/).filter((m) => LETTRE.test(m));
  if (motsA.length === motsB.length) {
    const ok = motsA.every((m, i) =>
      memeMot(squelette(m), squelette(motsB[i]), m, motsB[i])
    );
    return ok ? null : "mot remplacé par un autre";
  }
  // Un mot ↔ deux mots : on compare les graphies collées.
  return memeMot(sa, sb, avant.replace(/\s+/g, ""), apres.replace(/\s+/g, ""))
    ? null
    : "mot remplacé par un autre";
}

/* ------------------------------------------------------------------ */
/* Placement dans le texte                                             */
/* ------------------------------------------------------------------ */

function bornesDeMot(texte: string, debut: number, fin: number): boolean {
  const avant = debut > 0 ? texte[debut - 1] : "";
  const apres = fin < texte.length ? texte[fin] : "";
  return !(avant && LETTRE.test(avant)) && !(apres && LETTRE.test(apres));
}

/** Toutes les positions où `cherche` apparaît en mot entier. */
function occurrences(texte: string, cherche: string): number[] {
  const res: number[] = [];
  if (!cherche) return res;
  let i = texte.indexOf(cherche);
  while (i !== -1) {
    if (bornesDeMot(texte, i, i + cherche.length)) res.push(i);
    i = texte.indexOf(cherche, i + 1);
  }
  return res;
}

/** Positions du passage fautif, ou une raison de rejet. */
export function localiser(texte: string, p: Proposition): number[] | string {
  const extrait = p.extrait?.trim() ?? "";
  if (extrait && extrait.includes(p.fautif)) {
    const debuts: number[] = [];
    let i = texte.indexOf(extrait);
    while (i !== -1) {
      const dedans = occurrences(extrait, p.fautif).filter((j) =>
        bornesDeMot(texte, i + j, i + j + p.fautif.length)
      );
      if (dedans.length > 1) return "passage ambigu dans l'extrait";
      if (dedans.length === 1) debuts.push(i + dedans[0]);
      i = texte.indexOf(extrait, i + 1);
    }
    if (debuts.length) return debuts;
  }
  // Extrait inexact : on se rabat sur le passage seul, s'il est unique.
  const seules = occurrences(texte, p.fautif);
  if (seules.length === 1) return seules;
  return seules.length ? "passage ambigu" : "passage introuvable";
}

const DEBUT_DE_PHRASE = /(^\s*|[.!?…:;—–\-«"“(]\s*|\n\s*)$/;

function debutDePhrase(texte: string, debut: number): boolean {
  return DEBUT_DE_PHRASE.test(texte.slice(0, debut));
}

/** Le passage commence-t-il par une majuscule hors début de phrase (nom propre) ? */
function nomPropre(texte: string, debut: number): boolean {
  const c = texte[debut];
  if (!c || c === c.toLowerCase() || c !== c.toUpperCase()) return false;
  return !debutDePhrase(texte, debut);
}

/* ------------------------------------------------------------------ */
/* Le filtre                                                           */
/* ------------------------------------------------------------------ */

export function filtrer(
  texte: string,
  propositions: Proposition[],
  contexte: ContexteLivre = {}
): { corrections: Correction[]; rejets: Rejet[] } {
  const lexique = new Set(contexte.lexique ?? []);
  const rejets: Rejet[] = [];
  const candidates: Correction[] = [];

  for (const p of propositions) {
    const rejeter = (raison: string) => rejets.push({ proposition: p, raison });
    if (!p || typeof p.fautif !== "string" || typeof p.correction !== "string") {
      rejeter("proposition mal formée");
      continue;
    }
    if (!TYPES_CORRECTION.includes(p.type)) {
      rejeter("type inconnu");
      continue;
    }
    const fautif = p.fautif;
    const apres = p.correction;
    const raison = raisonDeRejet(fautif, apres);
    if (raison) {
      rejeter(raison);
      continue;
    }
    const positions = localiser(texte, p);
    if (typeof positions === "string") {
      rejeter(positions);
      continue;
    }
    // Vocabulaire du livre : un mot déjà écrit ailleurs n'est pas une faute
    // d'orthographe (personnage, mot inventé).
    if (
      p.type === "orthographe" &&
      squelette(fautif) !== squelette(apres) &&
      fautif.split(/\s+/).some((m) => m.length >= 3 && lexique.has(m.toLowerCase()))
    ) {
      rejeter("mot déjà présent dans le livre");
      continue;
    }
    for (const debut of positions) {
      // Nom propre (majuscule hors début de phrase) : on n'y touche pas.
      if (nomPropre(texte, debut)) {
        rejeter("nom propre");
        break;
      }
      candidates.push({ debut, fin: debut + fautif.length, avant: fautif, apres, type: p.type });
    }
  }

  // Ordre du texte, sans chevauchement (la première proposition gagne).
  candidates.sort((a, b) => a.debut - b.debut);
  const corrections: Correction[] = [];
  for (const c of candidates) {
    const prec = corrections[corrections.length - 1];
    if (prec && c.debut < prec.fin) {
      if (!(c.debut === prec.debut && c.fin === prec.fin && c.apres === prec.apres))
        rejets.push({
          proposition: { extrait: "", fautif: c.avant, correction: c.apres, type: c.type },
          raison: "chevauche une autre correction",
        });
      continue;
    }
    corrections.push(c);
  }

  if (!verifierReconstruction(texte, appliquer(texte, corrections), corrections))
    return { corrections: [], rejets };
  return { corrections, rejets };
}

/**
 * Texte corrigé, reconstruit par le code. `gardees` = indices des corrections
 * refusées par l'auteur (il garde sa version).
 */
export function appliquer(
  texte: string,
  corrections: Correction[],
  gardees: ReadonlySet<number> = new Set()
): string {
  let res = "";
  let curseur = 0;
  corrections.forEach((c, i) => {
    res += texte.slice(curseur, c.debut);
    res += gardees.has(i) ? texte.slice(c.debut, c.fin) : c.apres;
    curseur = c.fin;
  });
  return res + texte.slice(curseur);
}

/**
 * Vérifie que `corrige` ne diffère de `original` que sur les passages des
 * corrections, et qu'à ces endroits on trouve soit l'original soit la correction.
 */
export function verifierReconstruction(
  original: string,
  corrige: string,
  corrections: Correction[]
): boolean {
  let i = 0; // dans l'original
  let j = 0; // dans le corrigé
  for (const c of corrections) {
    if (c.debut < i || c.fin > original.length) return false;
    if (original.slice(c.debut, c.fin) !== c.avant) return false;
    const entre = original.slice(i, c.debut);
    if (corrige.slice(j, j + entre.length) !== entre) return false;
    j += entre.length;
    if (corrige.startsWith(c.apres, j)) j += c.apres.length;
    else if (corrige.startsWith(c.avant, j)) j += c.avant.length;
    else return false;
    i = c.fin;
  }
  return corrige.slice(j) === original.slice(i);
}

/** Mots d'un texte, en minuscules (pour le lexique du livre). */
export function mots(texte: string): string[] {
  return texte
    .replace(APOSTROPHES, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .flatMap((m) => m.split("'"))
    .filter((m) => m.length >= 3)
    .map((m) => m.toLowerCase());
}
