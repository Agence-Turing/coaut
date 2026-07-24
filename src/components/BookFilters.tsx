import Link from "next/link";
import type { BookFilters } from "@/lib/books";

const FIELD =
  "rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-peche focus:outline-none [&>option]:text-ink";

export default function BookFiltersBar({
  action,
  filters,
  themes,
  levels,
}: {
  action: string;
  filters: BookFilters;
  themes: string[];
  levels: string[];
}) {
  const hasFilters = Boolean(filters.q || filters.theme || filters.niveau);

  return (
    <form method="get" action={action} className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        name="q"
        defaultValue={filters.q ?? ""}
        placeholder="🔍 Un titre, un mot de l'histoire…"
        className={`${FIELD} min-w-56 flex-1 md:flex-none md:basis-72`}
      />
      <select name="theme" defaultValue={filters.theme ?? ""} className={FIELD}>
        <option value="">Tous les thèmes</option>
        {themes.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>
      <select name="niveau" defaultValue={filters.niveau ?? ""} className={FIELD}>
        <option value="">Tous les niveaux</option>
        {levels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
      >
        Filtrer
      </button>
      {hasFilters && (
        <Link
          href={action}
          className="text-sm font-semibold text-white/70 underline-offset-2 hover:text-peche hover:underline"
        >
          Réinitialiser
        </Link>
      )}
    </form>
  );
}
