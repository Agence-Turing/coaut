/**
 * Niveaux scolaires des livres (`books.scolar_level`) et leur libellé affiché.
 *
 * Les valeurs stockées sont celles de l'ancien site (« 6eme », « 5ème », « 2nde »…) et ne
 * changent pas ; seul l'affichage ajoute l'âge en début d'année scolaire, pour les
 * lecteurs hors de France (retour de Juliette du 20/11) : « CP · 6 ans ».
 */
export const NIVEAUX: { value: string; label: string }[] = [
  { value: "CP", label: "CP · 6 ans" },
  { value: "CE1", label: "CE1 · 7 ans" },
  { value: "CE2", label: "CE2 · 8 ans" },
  { value: "CM1", label: "CM1 · 9 ans" },
  { value: "CM2", label: "CM2 · 10 ans" },
  { value: "6eme", label: "6e · 11 ans" },
  { value: "5ème", label: "5e · 12 ans" },
  { value: "4ème", label: "4e · 13 ans" },
  { value: "3ème", label: "3e · 14 ans" },
  { value: "2nde", label: "2de · 15 ans" },
  { value: "1ère", label: "1re · 16 ans" },
  { value: "Terminale", label: "Terminale · 17 ans" },
  { value: "Enfant", label: "Enfant" },
  { value: "Adulte", label: "Adulte · 18 ans et plus" },
];

const LABELS = new Map(NIVEAUX.map((n) => [n.value, n.label]));
const ORDER = new Map(NIVEAUX.map((n, i) => [n.value, i]));

/** Libellé affiché d'un niveau stocké ; une valeur inconnue est montrée telle quelle. */
export function niveauLabel(value: string): string {
  return LABELS.get(value) ?? value;
}

/** Tri dans l'ordre scolaire (CP → Terminale, puis Enfant, Adulte), inconnus à la fin. */
export function compareNiveaux(a: string, b: string): number {
  const ia = ORDER.get(a) ?? NIVEAUX.length;
  const ib = ORDER.get(b) ?? NIVEAUX.length;
  return ia - ib || a.localeCompare(b, "fr", { sensitivity: "base" });
}
