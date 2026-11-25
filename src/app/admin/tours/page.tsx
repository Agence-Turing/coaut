import Link from "next/link";
import { booksAction, turnsAction } from "@/app/admin/actions";
import { BulkSubmit, ConfirmButton, FilterForm, SelectAll } from "@/components/admin/client";
import {
  Pagination,
  RowCheckbox,
  SMALL_BTN,
  SMALL_BTN_DANGER,
  SortHeader,
  TABLE,
  TABLE_WRAP,
  TD,
  TH,
  ModerationCell,
  Tag,
  hrefWith,
} from "@/components/admin/table";
import { INPUT, LINK, Notice } from "@/components/ui";
import {
  LATE_DAYS,
  UUID_RE,
  daysSince,
  formatDate,
  listAdminTurns,
  listLateTurns,
  param,
  type SearchParams,
} from "@/lib/admin/data";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";

const PATH = "/admin/tours";

export default async function AdminTurnsPage({ searchParams }: PageProps<"/admin/tours">) {
  const { db } = await requireAdminPage();
  const sp = await searchParams;
  // « Tours en retard » (réunion du 24/11) : un tableau par livre dont le tour n'avance pas.
  const late = param(sp, "retard") === "1";
  const back = hrefWith(PATH, sp);
  const notice = noticeFrom(sp);

  const livreId = param(sp, "livre_id");
  const auteurId = param(sp, "auteur_id");
  const [{ data: livre }, { data: auteur }] = await Promise.all([
    UUID_RE.test(livreId)
      ? db.from("books").select("title").eq("id", livreId).maybeSingle()
      : Promise.resolve({ data: null }),
    UUID_RE.test(auteurId)
      ? db.from("authors").select("nickname").eq("id", auteurId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold text-ink">Tours</h1>

      <FilterForm action={PATH}>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-52">
          Livre
          <input type="search" name="livre" defaultValue={param(sp, "livre")} placeholder="Titre ou code" className={INPUT} />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-44">
          Auteur
          <input type="search" name="auteur" defaultValue={param(sp, "auteur")} placeholder="Pseudo" className={INPUT} />
        </label>
        {!late && (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-52">
            Dans le texte
            <input type="search" name="q" defaultValue={param(sp, "q")} placeholder="Un mot du tour" className={INPUT} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Afficher
          <select name="retard" defaultValue={late ? "1" : ""} className={INPUT}>
            <option value="">Tous les tours</option>
            <option value="1">Tours en retard</option>
          </select>
        </label>
        {late && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Pas écrits depuis (jours)
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="jours"
              defaultValue={param(sp, "jours") || String(LATE_DAYS)}
              className={`${INPUT} sm:w-32`}
            />
          </label>
        )}
        {!late && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Bloqué par l&apos;IA
          <select name="ia" defaultValue={param(sp, "ia")} className={INPUT}>
            <option value="">Tous</option>
            <option value="bloque">Bloqués</option>
            <option value="revoir">À revoir</option>
          </select>
        </label>
        )}
        {["tri", "ordre", "livre_id", "auteur_id"].map((k) =>
          param(sp, k) ? <input key={k} type="hidden" name={k} value={param(sp, k)} /> : null
        )}
      </FilterForm>

      {(livre || auteur) && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {livre && (
            <span>
              Livre : <strong className="text-ink">{livre.title as string}</strong>{" "}
              <Link href={hrefWith(PATH, sp, { livre_id: null, page: null })} className={LINK}>
                retirer
              </Link>
            </span>
          )}
          {auteur && (
            <span>
              Auteur : <strong className="text-ink">{auteur.nickname as string}</strong>{" "}
              <Link href={hrefWith(PATH, sp, { auteur_id: null, page: null })} className={LINK}>
                retirer
              </Link>
            </span>
          )}
        </p>
      )}

      <Notice info={notice.info} error={notice.error} />

      {late ? <LateTurns db={db} sp={sp} back={back} /> : <AllTurns db={db} sp={sp} back={back} />}
    </div>
  );
}

/** Tous les tours écrits ou en brouillon. */
async function AllTurns({
  db,
  sp,
  back,
}: {
  db: SupabaseClient;
  sp: SearchParams;
  back: string;
}) {
  const { rows, total, page, pages, sort } = await listAdminTurns(db, sp);
  const sortProps = { path: PATH, sp, current: sort };
  return (
    <>
      <form action={turnsAction} className="flex flex-col gap-4">
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="bulk" value="supprime" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">Lignes cochées :</span>
          <BulkSubmit className={SMALL_BTN_DANGER} label="Supprimer" />
        </div>

        <div className={TABLE_WRAP}>
          <table className={`${TABLE} min-w-[60rem]`}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-11 p-0`}>
                  <SelectAll />
                </th>
                <SortHeader {...sortProps} sortKey="livre" label="Livre" />
                <SortHeader {...sortProps} sortKey="numero" label="N°" />
                <SortHeader {...sortProps} sortKey="auteur" label="Auteur" />
                <SortHeader {...sortProps} sortKey="date" label="Date" defaultDesc />
                <th scope="col" className={TH}>
                  Début du texte
                </th>
                <SortHeader {...sortProps} sortKey="ia" label="Bloqué par l'IA" defaultDesc />
                <th scope="col" className={TH}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className={`${TD} py-8 text-center text-muted`}>
                    Aucun tour ne correspond à ces filtres.
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-tint-cream/50">
                  <RowCheckbox id={t.id} label={`tour ${t.number} de ${t.book_title}`} />
                  <td className={`${TD} min-w-44`}>
                    <Link href={`/admin/livres/${t.book_id}`} className={LINK}>
                      {t.book_title}
                    </Link>
                    <span className="block text-xs text-muted">{t.legacy_code ?? "nouveau"}</span>
                  </td>
                  <td className={TD}>{t.number}</td>
                  <td className={TD}>
                    {t.author_id ? (
                      <Link href={`/admin/auteurs/${t.author_id}`} className={LINK}>
                        {t.author_nickname}
                      </Link>
                    ) : (
                      <span className="text-muted">Inconnu</span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(t.created_at)}</td>
                  <td className={`${TD} min-w-72 font-display text-[15px] leading-snug`}>
                    {!t.is_ended && (
                      <>
                        <Tag tone="soft">Brouillon en cours</Tag>{" "}
                      </>
                    )}
                    {t.excerpt}
                    {t.content_length > 160 ? "…" : ""}
                  </td>
                  <td className={TD}>
                    <ModerationCell status={t.moderation_status} reason={t.moderation_reason} />
                  </td>
                  <td className={TD}>
                    <div className="flex flex-nowrap gap-1.5">
                      <Link href={`${PATH}/${t.id}`} className={SMALL_BTN}>
                        Lire, modifier
                      </Link>
                      <ConfirmButton
                        name="do"
                        value={`supprime:${t.id}`}
                        className={SMALL_BTN_DANGER}
                        message={`Supprimer le tour ${t.number} de « ${t.book_title} » ? Les tours suivants sont renumérotés.`}
                      >
                        Supprimer
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      <Pagination path={PATH} sp={sp} page={page} pages={pages} total={total} noun={["tour", "tours"]} />
    </>
  );
}

/**
 * Tours en retard : livres en cours dont le tour n'a pas été terminé depuis au moins N jours
 * (15 par défaut), d'après le début du tour en cours ou, à défaut, le dernier tour terminé.
 * Les livres qui attendent leur équipe n'y sont pas (personne n'a la main).
 */
async function LateTurns({
  db,
  sp,
  back,
}: {
  db: SupabaseClient;
  sp: SearchParams;
  back: string;
}) {
  const { rows, total, page, pages, sort, days } = await listLateTurns(db, sp);
  const sortProps = { path: PATH, sp, current: sort };
  return (
    <>
      <p className="text-sm text-muted">
        Livres en cours dont le tour n&apos;a pas avancé depuis {days} jours ou plus (depuis la fin du
        tour précédent, un tour passé ou l&apos;équipe au complet). « Passer le tour » supprime le
        brouillon éventuel et prévient le suivant par mail.
      </p>
      <div className={TABLE_WRAP}>
        <table className={`${TABLE} min-w-[54rem]`}>
          <thead>
            <tr>
              <SortHeader {...sortProps} sortKey="livre" label="Livre" />
              <SortHeader {...sortProps} sortKey="numero" label="Tour" />
              <SortHeader {...sortProps} sortKey="auteur" label="À qui le tour" />
              <SortHeader {...sortProps} sortKey="date" label="En attente depuis" />
              <th scope="col" className={TH}>
                Brouillon
              </th>
              <th scope="col" className={TH}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className={`${TD} py-8 text-center text-muted`}>
                  Aucun tour en retard de {days} jours ou plus.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-tint-cream/50">
                <td className={`${TD} min-w-44`}>
                  <Link href={`/admin/livres/${b.id}`} className={LINK}>
                    {b.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {b.legacy_code ?? "nouveau"}
                    {b.class_name ? ` · classe ${b.class_name}` : ""}
                  </span>
                </td>
                <td className={TD}>{b.current_turn_number}</td>
                <td className={TD}>
                  {b.current_writer_id && (
                    <Link href={`/admin/auteurs/${b.current_writer_id}`} className={LINK}>
                      {b.current_writer_nickname}
                    </Link>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {formatDate(b.waiting_since)}
                  <span className="block text-xs text-muted">{daysSince(b.waiting_since)} jours</span>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  {b.draft_started_at ? (
                    <Tag tone="soft">commencé le {formatDate(b.draft_started_at)}</Tag>
                  ) : (
                    <span className="text-muted">aucun</span>
                  )}
                </td>
                <td className={TD}>
                  <div className="flex flex-nowrap gap-1.5">
                    {b.players_count > 1 && (
                      <form action={booksAction}>
                        <input type="hidden" name="back" value={back} />
                        <ConfirmButton
                          name="do"
                          value={`passe:${b.id}`}
                          className={SMALL_BTN}
                          message={`Passer le tour de ${b.current_writer_nickname ?? "l'auteur actuel"} dans « ${b.title} » ? Son brouillon en cours sera supprimé.`}
                        >
                          Passer le tour
                        </ConfirmButton>
                      </form>
                    )}
                    <Link href={`/admin/livres/${b.id}`} className={SMALL_BTN}>
                      Fiche du livre
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        path={PATH}
        sp={sp}
        page={page}
        pages={pages}
        total={total}
        noun={["tour en retard", "tours en retard"]}
      />
    </>
  );
}
