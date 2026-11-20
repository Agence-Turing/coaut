import { filtrer, mots, type Correction, type Rejet } from "./filtre.ts";
import { demanderCorrections } from "./ia.ts";
import { decouper } from "./decoupe.ts";

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
 * réponse de l'IA, renvoie une liste vide et `verifie: false`. Un texte long
 * part en plusieurs morceaux, relus en parallèle : un morceau sans réponse
 * n'empêche pas de proposer les corrections des autres.
 */
export async function corrigerTour(
  texte: string,
  livre: { titre?: string | null; resume?: string | null; tours?: (string | null)[] } = {}
): Promise<ResultatCorrection> {
  const autres = [livre.titre, livre.resume, ...(livre.tours ?? [])].filter(
    (t): t is string => Boolean(t)
  );
  const vocabulaire = nomsPropres([...autres, texte]);
  const lexique = new Set(autres.flatMap(mots));
  const debut = Date.now();
  const morceaux = decouper(texte);
  const resultats = await Promise.all(
    morceaux.map(async (m) => {
      const ia = await demanderCorrections(m.texte, vocabulaire);
      if (!ia) return null;
      const { corrections, rejets } = filtrer(m.texte, ia.propositions, { lexique });
      return {
        corrections: corrections.map((c) => ({ ...c, debut: c.debut + m.debut, fin: c.fin + m.debut })),
        rejets,
        usage: ia.usage,
      };
    })
  );
  const recus = resultats.filter((r) => r !== null);
  if (!recus.length) return { corrections: [], rejets: [], verifie: false };
  if (recus.length < morceaux.length)
    console.warn(`[correction] ${morceaux.length - recus.length}/${morceaux.length} morceau(x) sans réponse`);
  return {
    corrections: recus.flatMap((r) => r.corrections).sort((a, b) => a.debut - b.debut),
    rejets: recus.flatMap((r) => r.rejets),
    verifie: true,
    usage: {
      entree: recus.reduce((n, r) => n + r.usage.entree, 0),
      sortie: recus.reduce((n, r) => n + r.usage.sortie, 0),
    },
    dureeMs: Date.now() - debut,
  };
}
