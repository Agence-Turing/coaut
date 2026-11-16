import Link from "next/link";
import type { BookFilters } from "@/lib/books";
import { BTN_DARK, INPUT, LINK } from "@/components/ui";

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
    <form
      method="get"
      action={action}
      role="search"
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-64">
        Rechercher
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Un titre, un mot de l'histoire"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Thème
        <select name="theme" defaultValue={filters.theme ?? ""} className={INPUT}>
          <option value="">Tous les thèmes</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Niveau
        <select name="niveau" defaultValue={filters.niveau ?? ""} className={INPUT}>
          <option value="">Tous les niveaux</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" className={`${BTN_DARK} min-h-12`}>
          Filtrer
        </button>
        {hasFilters && (
          <Link href={action} className={`${LINK} inline-flex min-h-11 items-center text-sm`}>
            Tout afficher
          </Link>
        )}
      </div>
    </form>
  );
}
