import Link from "next/link";
import { booksAction } from "@/app/admin/actions";
import { BulkSubmit, ConfirmButton, FilterForm, SelectAll } from "@/components/admin/client";
import {
  Pagination,
  RowCheckbox,
  SMALL_BTN,
    SortHeader,
  TABLE,
  TABLE_WRAP,
  TD,
  TH,
  Tag,
  hrefWith,
} from "@/components/admin/table";
import { INPUT, LINK, Notice } from "@/components/ui";
import {
  INACTIVE_DAYS,
  STATUS_LABELS,
  daysSince,
  formatDate,
  listAdminBooks,
  param,
} from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";

const PATH = "/admin/livres";

export default async function AdminBooksPage({ searchParams }: PageProps<"/admin/livres">) {
  const { db } = await requireAdminPage();
  const sp = await searchParams;
  const { rows, total, page, pages, sort } = await listAdminBooks(db, sp);
  const back = hrefWith(PATH, sp);
  const notice = noticeFrom(sp);
  const auteur = param(sp, "auteur");
  const { data: auteurRow } = auteur
    ? await db.from("authors").select("nickname").eq("id", auteur).maybeSingle()
    : { data: null };

  const sortProps = { path: PATH, sp, current: sort };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold text-ink">Livres</h1>

      <FilterForm action={PATH}>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-64">
          Rechercher
          <input
            type="search"
            name="q"
            defaultValue={param(sp, "q")}
            placeholder="Titre, code ou lanceur"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Statut
          <select name="statut" defaultValue={param(sp, "statut")} className={INPUT}>
            <option value="">Tous</option>
            <option value="launched">En cours</option>
            <option value="published">Publiés</option>
            <option value="archived">Archivés</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Public ou classe
          <select name="visibilite" defaultValue={param(sp, "visibilite")} className={INPUT}>
            <option value="">Tous</option>
            <option value="public">Public</option>
            <option value="classe">Classe</option>
          </select>
        </label>
        <label className="flex min-h-12 items-center gap-2.5 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="inactif"
            value="1"
            defaultChecked={param(sp, "inactif") === "1"}
            className="h-5 w-5 accent-ink"
          />
          Sans tour depuis plus de {INACTIVE_DAYS} jours
        </label>
        {["tri", "ordre", "auteur", "classe"].map((k) =>
          param(sp, k) ? <input key={k} type="hidden" name={k} value={param(sp, k)} /> : null
        )}
      </FilterForm>

      {auteurRow && (
        <p className="text-sm text-muted">
          Livres de <strong className="text-ink">{auteurRow.nickname as string}</strong>.{" "}
          <Link href={hrefWith(PATH, sp, { auteur: null, page: null })} className={LINK}>
            Voir tous les livres
          </Link>
        </p>
      )}

      <Notice info={notice.info} error={notice.error} />

      <form action={booksAction} className="flex flex-col gap-4">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Pour les lignes cochées
            <select name="bulk" defaultValue="" className={INPUT}>
              <option value="">Choisir une action</option>
              <option value="archive">Archiver</option>
              <option value="relance">Remettre en cours</option>
              <option value="publie">Publier</option>
              <option value="supprime">Supprimer</option>
            </select>
          </label>
          <BulkSubmit className={SMALL_BTN} />
        </div>

        <div className={TABLE_WRAP}>
          <table className={`${TABLE} min-w-[74rem]`}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-11 p-0`}>
                  <SelectAll />
                </th>
                <SortHeader {...sortProps} sortKey="code" label="Code" />
                <SortHeader {...sortProps} sortKey="titre" label="Titre" />
                <SortHeader {...sortProps} sortKey="statut" label="Statut" />
                <th scope="col" className={TH}>
                  Public / classe
                </th>
                <SortHeader {...sortProps} sortKey="lanceur" label="Lanceur" />
                <SortHeader {...sortProps} sortKey="coauteurs" label="Co-auteurs" defaultDesc />
                <SortHeader {...sortProps} sortKey="tours" label="Tours" defaultDesc />
                <SortHeader {...sortProps} sortKey="dernier" label="Dernier tour" defaultDesc />
                <SortHeader {...sortProps} sortKey="tour" label="À qui le tour" />
                <th scope="col" className={TH}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className={`${TD} py-8 text-center text-muted`}>
                    Aucun livre ne correspond à ces filtres.
                  </td>
                </tr>
              )}
              {rows.map((b) => {
                const since = daysSince(b.last_activity_at);
                return (
                  <tr key={b.id} className="hover:bg-tint-cream/50">
                    <RowCheckbox id={b.id} label={b.title} />
                    <td className={`${TD} whitespace-nowrap text-muted`}>
                      {b.legacy_code ?? "nouveau"}
                    </td>
                    <td className={`${TD} min-w-48`}>
                      <Link href={`${PATH}/${b.id}`} className={LINK}>
                        {b.title}
                      </Link>
                    </td>
                    <td className={TD}>
                      <Tag tone={b.status === "archived" ? "warn" : b.status === "published" ? "soft" : "neutral"}>
                        {STATUS_LABELS[b.status]}
                      </Tag>
                    </td>
                    <td className={TD}>
                      {b.class_id ? (
                        <Link href={`/admin/classes/${b.class_id}`} className={LINK}>
                          {b.class_name ?? "Classe"}
                        </Link>
                      ) : (
                        "Public"
                      )}
                    </td>
                    <td className={TD}>{b.launcher_nickname}</td>
                    <td className={`${TD} min-w-40`}>
                      <span className="font-semibold">
                        {b.players_count}
                        {b.max_players ? `/${b.max_players}` : ""}
                      </span>
                      {b.players.length > 0 && (
                        <span className="block text-xs text-muted">{b.players.join(", ")}</span>
                      )}
                    </td>
                    <td className={TD}>{b.turns_count}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(b.last_turn_at)}</td>
                    <td className={TD}>
                      {b.status === "launched" && b.current_writer_nickname ? (
                        <>
                          {b.current_writer_nickname}
                          {since !== null && (
                            <span
                              className={`block text-xs ${since > INACTIVE_DAYS ? "font-semibold text-link" : "text-muted"}`}
                            >
                              depuis {since} j
                            </span>
                          )}
                        </>
                      ) : null}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-nowrap gap-1.5">
                        <Link href={`${PATH}/${b.id}`} className={SMALL_BTN}>
                          Gérer
                        </Link>
                        {b.status === "launched" && b.players_count > 1 && (
                          <ConfirmButton
                            name="do"
                            value={`passe:${b.id}`}
                            className={SMALL_BTN}
                            message={`Passer le tour de ${b.current_writer_nickname ?? "l'auteur actuel"} ? Son brouillon en cours sera supprimé.`}
                          >
                            Passer le tour
                          </ConfirmButton>
                        )}
                        {b.status === "archived" ? (
                          <button type="submit" name="do" value={`relance:${b.id}`} className={SMALL_BTN}>
                            Remettre en cours
                          </button>
                        ) : (
                          <button type="submit" name="do" value={`archive:${b.id}`} className={SMALL_BTN}>
                            Archiver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>

      <Pagination path={PATH} sp={sp} page={page} pages={pages} total={total} noun={["livre", "livres"]} />
    </div>
  );
}
