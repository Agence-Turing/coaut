/**
 * Onglet du menu d'où l'on vient quand on ouvre un livre.
 * La page d'un livre a une seule adresse (/books/[code]) quelle que soit la liste
 * d'origine : les fiches ajoutent `?from=…` pour que l'onglet reste souligné.
 */
export const NAV_FROM = {
  rejoindre: "/books",
  biblio: "/bibliotheque",
  "mes-livres": "/books/mes-livres",
  classes: "/classes",
} as const;

export type NavFrom = keyof typeof NAV_FROM;

export function navFromHref(from: unknown): string | null {
  return typeof from === "string" && Object.hasOwn(NAV_FROM, from)
    ? NAV_FROM[from as NavFrom]
    : null;
}
