/* eslint-disable @next/next/no-img-element */

/**
 * Couverture d'un livre, au format portrait 3:4.
 * Sur la couverture : le titre principal et l'image, rien d'autre (tome, dates,
 * thème et places libres s'affichent sous la couverture, dans BookCard).
 * - `coverPath` renseigné : illustration servie par /couvertures/<fichier>, titre posé par-dessus.
 * - sinon : couverture composée par le code (aplat tiré du code du livre, titre).
 * Jamais de trou ni d'image cassée.
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
  coverPath,
  size = "card",
}: {
  /** Code ou identifiant du livre : fixe la couleur du repli. */
  seed: string;
  /** Titre principal seul (voir splitTitle). */
  title: string;
  coverPath?: string | null;
  size?: "card" | "page";
}) {
  const titleSize =
    size === "page"
      ? "text-2xl"
      : title.length > 44
        ? "text-base sm:text-lg"
        : title.length > 24
          ? "text-lg sm:text-xl"
          : "text-xl sm:text-2xl";

  if (coverPath) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden rounded-l-md rounded-r-[14px] border border-line border-l-[6px] border-l-ink bg-surface">
        <img
          src={`/couvertures/${encodeURIComponent(coverPath)}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative flex h-full flex-col justify-end p-3.5">
          <p
            className={`break-words rounded-lg bg-paper px-3 py-2.5 font-display font-bold leading-[1.1] text-ink ${titleSize}`}
          >
            {title}
          </p>
        </div>
      </div>
    );
  }

  const palette = PALETTES[stableIndex(seed, PALETTES.length)];
  return (
    <div
      className={`relative flex aspect-[3/4] flex-col justify-center overflow-hidden rounded-l-md rounded-r-[14px] border border-line border-l-[6px] border-l-ink p-4 ${palette}`}
    >
      <p className={`break-words font-display font-bold leading-[1.08] ${titleSize}`}>
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
