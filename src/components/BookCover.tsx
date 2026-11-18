/**
 * Couverture d'un livre, composée par le code : petit livre portrait 3:4,
 * aplat de couleur tiré du code du livre, tranche foncée, titre principal.
 * Plus d'illustration (décision de Juliette du 16/11 : des couleurs à la place) ;
 * `books.cover_path` reste en base mais l'interface ne le lit plus.
 * La largeur vient du parent ; tome, dates, thème et repères s'affichent à côté (BookCard).
 */

/* Les teintes claires dominent : les aplats vifs restent l'exception sur l'étagère. */
const PALETTES = [
  "bg-tint-orange text-ink",
  "bg-surface text-ink",
  "bg-ink text-paper",
  "bg-tint-rose text-ink",
  "bg-tint-cream text-ink",
  "bg-brand text-ink",
  "bg-surface text-ink",
  "bg-tint-orange text-ink",
  "bg-accent-deep text-paper",
  "bg-tint-rose text-ink",
] as const;

/** Indice stable tiré d'une chaîne (le code ou l'id du livre). */
function stableIndex(seed: string, modulo: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % modulo;
}

export default function BookCover({
  seed,
  title,
  size = "card",
}: {
  /** Code ou identifiant du livre : fixe la couleur. */
  seed: string;
  /** Titre principal seul (voir splitTitle). */
  title: string;
  /** `card` : vignette d'une fiche de liste ; `page` : en tête de la page d'un livre. */
  size?: "card" | "page";
}) {
  const palette = PALETTES[stableIndex(seed, PALETTES.length)];
  const titleSize =
    size === "page"
      ? "p-3 text-base"
      : title.length > 40
        ? "p-1.5 text-[10px] sm:p-2 sm:text-xs"
        : "p-1.5 text-[11px] sm:p-2 sm:text-sm";

  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[3/4] w-full flex-col justify-center overflow-hidden rounded-l-sm rounded-r-lg border border-line border-l-[5px] border-l-ink ${palette} ${titleSize}`}
    >
      <p className="line-clamp-6 break-words font-display font-bold leading-[1.1]">
        {title}
      </p>
    </div>
  );
}

/** Pastille posée sur une couverture. */
export function CoverBadge({
  children,
  tone = "paper",
}: {
  children: React.ReactNode;
  /** `brand` : pastille avec un point orange, pour « à toi d'écrire ». */
  tone?: "paper" | "brand";
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-2.5 py-1 text-xs font-semibold text-ink">
      {tone === "brand" && (
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand" />
      )}
      {children}
    </span>
  );
}
