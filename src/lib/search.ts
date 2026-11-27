/**
 * Texte tapé dans une recherche, prêt pour un filtre `ilike` de PostgREST
 * (à placer entre guillemets : `col.ilike."*${terme}*"`).
 *
 * - retire les caractères qui ont un sens dans les filtres PostgREST ;
 * - toute apostrophe (droite ' du clavier, typographique ’ des titres repris
 *   de Notion, ‘ ʼ `) devient `_`, le joker « un caractère » de LIKE :
 *   « L'école » trouve « L’école » et inversement.
 */
export function searchTerm(q: string): string {
  return q
    .replace(/[%*,()"\\:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/['’‘ʼ`_]/g, "_");
}
