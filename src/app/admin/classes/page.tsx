import Link from "next/link";
import { classesAction } from "@/app/admin/actions";
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
import { formatDate, listAdminClasses, param } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";

const PATH = "/admin/classes";

export default async function AdminClassesPage({ searchParams }: PageProps<"/admin/classes">) {
  const { db } = await requireAdminPage();
  const sp = await searchParams;
  const { rows, total, page, pages, sort } = await listAdminClasses(db, sp);
  const back = hrefWith(PATH, sp);
  const notice = noticeFrom(sp);
  const sortProps = { path: PATH, sp, current: sort };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-3xl font-bold text-ink">Classes</h1>

      <FilterForm action={PATH}>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-64">
          Rechercher
          <input
            type="search"
            name="q"
            defaultValue={param(sp, "q")}
            placeholder="Classe, prof ou e-mail du prof"
            className={INPUT}
          />
        </label>
        {["tri", "ordre"].map((k) =>
          param(sp, k) ? <input key={k} type="hidden" name={k} value={param(sp, k)} /> : null
        )}
      </FilterForm>

      <Notice info={notice.info} error={notice.error} />

      <form action={classesAction} className="flex flex-col gap-4">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Pour les lignes cochées
            <select name="bulk" defaultValue="" className={INPUT}>
              <option value="">Choisir une action</option>
              <option value="bloque">Bloquer la classe</option>
              <option value="debloque">Débloquer la classe</option>
              <option value="bloque_prof">Bloquer le prof</option>
              <option value="debloque_prof">Débloquer le prof</option>
              <option value="supprime">Supprimer</option>
            </select>
          </label>
          <BulkSubmit className={SMALL_BTN} />
        </div>

        <div className={TABLE_WRAP}>
          <table className={`${TABLE} min-w-[56rem]`}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-11 p-0`}>
                  <SelectAll />
                </th>
                <SortHeader {...sortProps} sortKey="classe" label="Classe" />
                <SortHeader {...sortProps} sortKey="prof" label="Prof" />
                <SortHeader {...sortProps} sortKey="eleves" label="Élèves" defaultDesc />
                <SortHeader {...sortProps} sortKey="livres" label="Livres" defaultDesc />
                <SortHeader {...sortProps} sortKey="creee" label="Créée le" defaultDesc />
                <th scope="col" className={TH}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className={`${TD} py-8 text-center text-muted`}>
                    Aucune classe ne correspond.
                  </td>
                </tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-tint-cream/50">
                  <RowCheckbox id={c.id} label={c.name} />
                  <td className={`${TD} min-w-44`}>
                    <Link href={`${PATH}/${c.id}`} className={LINK}>
                      {c.name}
                    </Link>
                    {c.is_blocked && (
                      <span className="mt-1 block">
                        <Tag tone="warn">Bloquée</Tag>
                      </span>
                    )}
                  </td>
                  <td className={`${TD} min-w-52`}>
                    <Link href={`/admin/auteurs/${c.owner_id}`} className={LINK}>
                      {c.owner_nickname}
                    </Link>
                    {c.owner_blocked && (
                      <>
                        {" "}
                        <Tag tone="warn">Bloqué</Tag>
                      </>
                    )}
                    <span className="block text-xs text-muted [overflow-wrap:anywhere]">{c.owner_email}</span>
                  </td>
                  <td className={TD}>{c.students_count}</td>
                  <td className={TD}>
                    <Link href={`/admin/livres?classe=${c.id}`} className={LINK}>
                      {c.books_count}
                    </Link>
                    {c.launched_count > 0 && (
                      <span className="block text-xs text-muted">{c.launched_count} en cours</span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{formatDate(c.created_at)}</td>
                  <td className={TD}>
                    <div className="flex flex-nowrap gap-1.5">
                      <Link href={`${PATH}/${c.id}`} className={SMALL_BTN}>
                        Élèves et codes
                      </Link>
                      {c.is_blocked ? (
                        <button type="submit" name="do" value={`debloque:${c.id}`} className={SMALL_BTN}>
                          Débloquer
                        </button>
                      ) : (
                        <ConfirmButton
                          name="do"
                          value={`bloque:${c.id}`}
                          className={SMALL_BTN}
                          message={`Bloquer la classe « ${c.name} » ? Ses ${c.students_count} élèves ne pourront plus entrer ni écrire.`}
                        >
                          Bloquer
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      <Pagination path={PATH} sp={sp} page={page} pages={pages} total={total} noun={["classe", "classes"]} />
    </div>
  );
}
