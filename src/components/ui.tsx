import Link from "next/link";
import type { ComponentProps } from "react";

/** Briques d'interface communes (direction « Carnet »). */

const BTN_BASE =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] px-5 text-[15px] font-semibold transition-colors disabled:opacity-60";

export const BTN_PRIMARY = `${BTN_BASE} bg-brand text-ink hover:bg-brand-hover`;
export const BTN_SECONDARY = `${BTN_BASE} border border-line-strong bg-paper text-ink hover:border-ink`;
export const BTN_DARK = `${BTN_BASE} bg-ink text-paper hover:bg-muted`;

export const INPUT =
  "block min-h-12 w-full rounded-[10px] border border-line-strong bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15";

export const LABEL = "block text-sm font-semibold text-ink";

export const HINT = "text-sm text-muted";

export const LINK = "font-medium text-link underline-offset-2 hover:text-link-hover hover:underline";

/** Petit libellé en capitales espacées (thème, rubrique). */
export const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.14em] text-subtle";

export const PILL =
  "inline-flex items-center rounded-full bg-surface px-3 py-1.5 text-sm text-ink";

type CtaProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "dark";
};

/** Lien présenté comme un bouton. */
export function Cta({ variant = "primary", className = "", ...props }: CtaProps) {
  const styles =
    variant === "primary"
      ? BTN_PRIMARY
      : variant === "dark"
        ? BTN_DARK
        : BTN_SECONDARY;
  return <Link {...props} className={`${styles} ${className}`} />;
}

/** Message de retour d'une action : erreur ou information. */
export function Notice({
  error,
  info,
  className = "",
}: {
  error?: string;
  info?: string;
  className?: string;
}) {
  if (error)
    return (
      <p
        role="alert"
        className={`rounded-[10px] border border-accent/40 bg-tint-rose px-3.5 py-3 text-sm font-medium text-link-hover ${className}`}
      >
        {error}
      </p>
    );
  if (info)
    return (
      <p
        role="status"
        className={`rounded-[10px] bg-tint-cream px-3.5 py-3 text-sm font-medium text-ink ${className}`}
      >
        {info}
      </p>
    );
  return null;
}

/** En-tête de page : rubrique, titre, phrase d'introduction. */
export function PageHeading({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {eyebrow && <p className={EYEBROW}>{eyebrow}</p>}
      <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
        {title}
      </h1>
      {intro && <p className="text-[17px] leading-relaxed text-muted">{intro}</p>}
      {children}
    </div>
  );
}
