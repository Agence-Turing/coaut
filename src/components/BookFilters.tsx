"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import type { BookFilters } from "@/lib/books";
import { INPUT, LINK } from "@/components/ui";
import { niveauLabel } from "@/lib/niveaux";

/**
 * Filtres des listes de livres : ils s'appliquent dès qu'on change une liste,
 * et la recherche après une courte pause de frappe. Pas de bouton « Filtrer ».
 * Sans JavaScript, le formulaire reste un GET classique (Entrée dans la recherche).
 */
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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();
  const hasFilters = Boolean(filters.q || filters.theme || filters.niveau);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const v = String(value).trim();
      if (v) params.set(key, v);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  function applySoon() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(apply, 400);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      role="search"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-64">
        Rechercher
        <input
          type="search"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Un titre, un mot de l'histoire"
          onChange={applySoon}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Thème
        <select
          name="theme"
          defaultValue={filters.theme ?? ""}
          onChange={apply}
          className={INPUT}
        >
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
        <select
          name="niveau"
          defaultValue={filters.niveau ?? ""}
          onChange={apply}
          className={INPUT}
        >
          <option value="">Tous les niveaux</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {niveauLabel(l)}
            </option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <Link
          href={action}
          onClick={() => formRef.current?.reset()}
          className={`${LINK} inline-flex min-h-12 items-center text-sm`}
        >
          Tout afficher
        </Link>
      )}
    </form>
  );
}
