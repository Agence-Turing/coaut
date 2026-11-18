import { filtrer, mots, type Correction, type Rejet } from "./filtre.ts";
import { demanderCorrections } from "./ia.ts";

export type { Correction } from "./filtre.ts";

export type ResultatCorrection = {
  /** Corrections acceptées par le filtre, dans l'ordre du texte. */
  corrections: Correction[];
  rejets: Rejet[];
  /** false si l'IA n'a pas répondu (envoi sans correction). */
  verifie: boolean;
  usage?: { entree: number; sortie: number };
  dureeMs?: number;
};

/** Noms propres du livre (mots à majuscule hors début de phrase), pour l'IA. */
function nomsPropres(textes: string[]): string[] {
  const noms = new Set<string>();
  for (const t of textes) {
    for (const m of t.matchAll(/(?<![.!?…—–\-«"“\n]\s*)(?<=\s)(\p{Lu}[\p{L}'-]+)/gu))
      noms.add(m[1]);
  }
  return [...noms].slice(0, 80);
}

/**
 * Fautes d'un tour, prêtes à montrer à l'auteur. Ne lève jamais : sans
 * réponse de l'IA, renvoie une liste vide et `verifie: false`.
 */
export async function corrigerTour(
  texte: string,
  livre: { titre?: string | null; resume?: string | null; tours?: (string | null)[] } = {}
): Promise<ResultatCorrection> {
  const autres = [livre.titre, livre.resume, ...(livre.tours ?? [])].filter(
    (t): t is string => Boolean(t)
  );
  const ia = await demanderCorrections(texte, nomsPropres([...autres, texte]));
  if (!ia) return { corrections: [], rejets: [], verifie: false };
  const lexique = new Set(autres.flatMap(mots));
  const { corrections, rejets } = filtrer(texte, ia.propositions, { lexique });
  return { corrections, rejets, verifie: true, usage: ia.usage, dureeMs: ia.dureeMs };
}
