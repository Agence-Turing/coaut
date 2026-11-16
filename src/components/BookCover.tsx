/* eslint-disable @next/next/no-img-element */

/**
 * Couverture d'un livre, au format portrait 3:4.
 * - `coverPath` renseigné : illustration servie par /couvertures/<fichier>, titre posé par-dessus.
 * - sinon : couverture composée par le code (aplat tiré du code du livre, thème, titre).
 * Jamais de trou ni d'image cassée.
 */

const PALETTES = [
  "bg-ink text-paper",
  "bg-brand text-ink",
  "bg-tint-orange text-ink",
  "bg-tint-rose text-ink",
  "bg-surface text-ink",
  "bg-accent-deep text-paper",
  "bg-tint-cream text-ink",
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
  theme,
  coverPath,
  badge,
  size = "card",
}: {
  /** Code ou identifiant du livre : fixe la couleur du repli. */
  seed: string;
  title: string;
  theme?: string;
  coverPath?: string | null;
  /** Pastille en haut à gauche (places libres, « à toi d'écrire »). */
  badge?: React.ReactNode;
  size?: "card" | "page";
}) {
  const titleSize =
    size === "page" ? "text-2xl" : title.length > 38 ? "text-lg" : "text-xl";

  if (coverPath) {
    return (
      <div className="relative aspect-[3/4] overflow-hidden rounded-l-md rounded-r-[14px] border border-line border-l-[6px] border-l-ink bg-surface">
        <img
          src={`/couvertures/${encodeURIComponent(coverPath)}`}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="relative flex h-full flex-col justify-between p-3.5">
          <div className="flex flex-wrap gap-1.5">{badge}</div>
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
      className={`relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-l-md rounded-r-[14px] border border-line border-l-[6px] border-l-ink p-4 ${palette}`}
    >
      <div className="flex min-h-7 flex-wrap gap-1.5">{badge}</div>
      <p className={`break-words font-display font-bold leading-[1.08] ${titleSize}`}>
        {title}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
        {theme || "Co-Aut"}
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
  tone?: "paper" | "brand";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-ink ${
        tone === "brand" ? "bg-brand" : "bg-paper"
      }`}
    >
      {children}
    </span>
  );
}
