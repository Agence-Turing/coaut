import Link from "next/link";
import type { SearchParams } from "@/lib/admin/data";
import { BTN_SECONDARY } from "@/components/ui";

/*
 * Briques des tableaux d'administration : en-tête triable, pagination, cases à cocher.
 * Tout passe par l'URL (tri, page, filtres) : un tableau se partage et se recharge tel quel.
 */

const FEEDBACK = ["ok", "erreur", "n"];

/** URL de la page avec les paramètres actuels, modifiés par `changes` (null = retiré). */
export function hrefWith(
  path: string,
  sp: SearchParams,
  changes: Record<string, string | number | null> = {}
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (FEEDBACK.includes(k) || v === undefined) continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) params.set(k, value);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export const TABLE_WRAP = "overflow-x-auto rounded-2xl border border-line";
export const TABLE = "w-full border-collapse text-left text-sm";
export const TH = "whitespace-nowrap border-b border-line bg-surface px-3 py-2.5 font-semibold text-ink";
export const TD = "border-b border-line px-3 py-2.5 align-top text-ink";
export const SMALL_BTN =
  "inline-flex min-h-11 whitespace-nowrap items-center justify-center rounded-[10px] border border-line-strong bg-paper px-3 text-sm font-semibold text-ink hover:border-ink";
export const SMALL_BTN_DANGER =
  "inline-flex min-h-11 whitespace-nowrap items-center justify-center rounded-[10px] border border-accent/40 bg-paper px-3 text-sm font-semibold text-link hover:border-link";

/** En-tête de colonne triable : un clic trie, un deuxième inverse. */
export function SortHeader({
  path,
  sp,
  sortKey,
  current,
  label,
  defaultDesc = false,
}: {
  path: string;
  sp: SearchParams;
  sortKey: string;
  current: { key: string; ascending: boolean };
  label: string;
  /** Premier clic en ordre décroissant (dates, compteurs). */
  defaultDesc?: boolean;
}) {
  const active = current.key === sortKey;
  const nextOrder = active ? (current.ascending ? "desc" : "asc") : defaultDesc ? "desc" : "asc";
  return (
    <th
      scope="col"
      className={TH}
      aria-sort={active ? (current.ascending ? "ascending" : "descending") : undefined}
    >
      <Link
        href={hrefWith(path, sp, { tri: sortKey, ordre: nextOrder, page: null })}
        className="inline-flex min-h-8 items-center gap-1 hover:text-link"
      >
        {label}
        <span aria-hidden="true" className={active ? "text-ink" : "text-line-strong"}>
          {active ? (current.ascending ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export function Pagination({
  path,
  sp,
  page,
  pages,
  total,
  noun,
}: {
  path: string;
  sp: SearchParams;
  page: number;
  pages: number;
  total: number;
  noun: [string, string];
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        {total} {total > 1 ? noun[1] : noun[0]}
        {pages > 1 && ` · page ${page} sur ${pages}`}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={hrefWith(path, sp, { page: page - 1 })} className={BTN_SECONDARY}>
              Précédente
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={hrefWith(path, sp, { page: page + 1 })} className={BTN_SECONDARY}>
              Suivante
            </Link>
          ) : null}
        </div>
      )}
    </nav>
  );
}

/** Case à cocher d'une ligne, avec une zone de clic de 44 px. */
export function RowCheckbox({ id, label }: { id: string; label: string }) {
  return (
    <td className={`${TD} w-11 p-0`}>
      <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
        <input type="checkbox" name="ids" value={id} className="h-5 w-5 accent-ink" />
        <span className="sr-only">Sélectionner {label}</span>
      </label>
    </td>
  );
}

/** Pastille sobre (statut, oui/non). */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "soft";
}) {
  const styles =
    tone === "warn"
      ? "bg-tint-rose text-link-hover"
      : tone === "soft"
        ? "bg-tint-cream text-ink"
        : "bg-surface text-ink";
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

/** Colonne « Bloqué par l'IA » : vide tant que la modération n'a rien signalé. */
export function ModerationCell({
  status,
  reason,
}: {
  status: string | null;
  reason: string | null;
}) {
  if (status === "blocked")
    return (
      <>
        <Tag tone="warn">Bloqué</Tag>
        {reason && <span className="mt-1 block text-xs text-muted">{reason}</span>}
      </>
    );
  if (status === "review")
    return (
      <>
        <Tag tone="soft">À revoir</Tag>
        {reason && <span className="mt-1 block text-xs text-muted">{reason}</span>}
      </>
    );
  return null;
}
