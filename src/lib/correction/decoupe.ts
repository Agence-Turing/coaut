/** Découpage d'un long tour pour la relecture (pur, testé par `decoupe.test.ts`). */

/** Taille visée d'un morceau envoyé à l'IA (caractères). */
const TAILLE_MORCEAU = 700;

/**
 * Découpe le texte en morceaux d'environ 700 caractères, avec leur position
 * dans le texte. On coupe après un retour à la ligne, ou à défaut après une fin
 * de phrase (un long paragraphe sans retour à la ligne), jamais au milieu
 * d'une phrase.
 */
export function decouper(texte: string, taille = TAILLE_MORCEAU): { debut: number; texte: string }[] {
  const lignes: { debut: number; fin: number }[] = [];
  const re = /[^\n]*?(?:[.!?…]+[ \t]+|\n|$)/g;
  for (let m = re.exec(texte); m && m.index < texte.length; m = re.exec(texte)) {
    if (!m[0]) { re.lastIndex++; continue; }
    lignes.push({ debut: m.index, fin: m.index + m[0].length });
  }
  const morceaux: { debut: number; texte: string }[] = [];
  let debut = 0;
  for (const l of lignes) {
    if (l.debut > debut && l.fin - debut > taille) {
      morceaux.push({ debut, texte: texte.slice(debut, l.debut) });
      debut = l.debut;
    }
  }
  if (debut < texte.length) morceaux.push({ debut, texte: texte.slice(debut) });
  return morceaux.filter((m) => /[\p{L}\p{N}]/u.test(m.texte));
}
