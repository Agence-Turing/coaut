/**
 * Thèmes d'un livre, saisis librement : « aventure » et « Aventure » sont le même filtre.
 * Forme rangée en base : espaces réduits, première lettre en majuscule, fautes connues
 * corrigées, sans doublon (casse ignorée). Même règle dans `scripts/import-notion.py`
 * (`clean_theme`) et dans la migration 0014 pour les livres déjà en base.
 */
const CORRECTIONS: Record<string, string> = { "amitiè": "Amitié", amitie: "Amitié" };

export function normaliserTheme(brut: string): string {
  const t = brut.split(/\s+/).filter(Boolean).join(" ");
  return CORRECTIONS[t.toLowerCase()] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

/** « aventure, Aventure ,Amitiè » → ["Aventure", "Amitié"]. */
export function normaliserThemes(saisie: string | string[]): string[] {
  const brut = Array.isArray(saisie) ? saisie : saisie.split(",");
  const vus = new Set<string>();
  const out: string[] = [];
  for (const b of brut) {
    const t = normaliserTheme(b);
    if (!t || vus.has(t.toLowerCase())) continue;
    vus.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}
