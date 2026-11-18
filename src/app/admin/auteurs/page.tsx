import Link from "next/link";
import { authorsAction } from "@/app/admin/actions";
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
import { BTN_SECONDARY, INPUT, LINK, Notice } from "@/components/ui";
import { AGE_RANGES, formatDate, listAdminAuthors, param } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";
import { ageFrom } from "@/lib/profile";

const PATH = "/admin/auteurs";

function YesNoFilter({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <select name={name} defaultValue={value} className={INPUT}>
        <option value="">Tous</option>
        <option value="1">Oui</option>
        <option value="0">Non</option>
      </select>
    </label>
  );
}

export default async function AdminAuthorsPage({ searchParams }: PageProps<"/admin/auteurs">) {
  const { db, userId } = await requireAdminPage();
  const sp = await searchParams;
  const { rows, total, page, pages, sort } = await listAdminAuthors(db, sp);
  const back = hrefWith(PATH, sp);
  const exportHref = hrefWith(`${PATH}/export`, sp, { tri: null, ordre: null, page: null });
  const notice = noticeFrom(sp);
  const deletedView = param(sp, "supprimes") === "1";
  const sortProps = { path: PATH, sp, current: sort };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Auteurs</h1>
        <a href={exportHref} className={BTN_SECONDARY}>
          Exporter en CSV ({total})
        </a>
      </div>

      <FilterForm action={PATH}>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink sm:min-w-64">
          Rechercher
          <input
            type="search"
            name="q"
            defaultValue={param(sp, "q")}
            placeholder="Pseudo, nom, e-mail ou ville"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Âge
          <select name="age" defaultValue={param(sp, "age")} className={INPUT}>
            <option value="">Tous</option>
            {Object.entries(AGE_RANGES).map(([k, r]) => (
              <option key={k} value={k}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Comptes
          <select name="comptes" defaultValue={param(sp, "comptes")} className={INPUT}>
            <option value="">Adultes</option>
            <option value="eleves">Élèves des classes</option>
            <option value="tous">Tous</option>
          </select>
        </label>
        <YesNoFilter name="pro" label="Pro" value={param(sp, "pro")} />
        <YesNoFilter name="newsletter" label="Newsletter" value={param(sp, "newsletter")} />
        <YesNoFilter name="bloque" label="Bloqué" value={param(sp, "bloque")} />
        <label className="flex min-h-12 items-center gap-2.5 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="supprimes"
            value="1"
            defaultChecked={deletedView}
            className="h-5 w-5 accent-ink"
          />
          Auteurs supprimés
        </label>
        {["tri", "ordre"].map((k) =>
          param(sp, k) ? <input key={k} type="hidden" name={k} value={param(sp, k)} /> : null
        )}
      </FilterForm>

      <Notice info={notice.info} error={notice.error} />

      <form action={authorsAction} className="flex flex-col gap-4">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Pour les lignes cochées
            <select name="bulk" defaultValue="" className={INPUT}>
              <option value="">Choisir une action</option>
              <option value="bloque">Bloquer</option>
              <option value="debloque">Débloquer</option>
              <option value="supprime">Supprimer</option>
            </select>
          </label>
          <BulkSubmit className={SMALL_BTN} />
        </div>

        <div className={TABLE_WRAP}>
          <table className={`${TABLE} min-w-[76rem]`}>
            <thead>
              <tr>
                <th scope="col" className={`${TH} w-11 p-0`}>
                  <SelectAll />
                </th>
                <SortHeader {...sortProps} sortKey="pseudo" label="Pseudo" />
                <SortHeader {...sortProps} sortKey="nom" label="Prénom et nom" />
                <SortHeader {...sortProps} sortKey="email" label="E-mail" />
                <SortHeader {...sortProps} sortKey="age" label="Âge" />
                <SortHeader {...sortProps} sortKey="ville" label="Ville" />
                <SortHeader {...sortProps} sortKey="pro" label="Pro" defaultDesc />
                <SortHeader {...sortProps} sortKey="newsletter" label="Newsletter" defaultDesc />
                <SortHeader {...sortProps} sortKey="inscrit" label="Inscrit le" defaultDesc />
                <SortHeader {...sortProps} sortKey="dernier" label="Dernier tour" defaultDesc />
                <SortHeader {...sortProps} sortKey="bloque" label="Bloqué" defaultDesc />
                <th scope="col" className={TH}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className={`${TD} py-8 text-center text-muted`}>
                    Aucun auteur ne correspond à ces filtres.
                  </td>
                </tr>
              )}
              {rows.map((a) => {
                const protectedRow = a.is_admin || a.user_id === userId || Boolean(a.deleted_at);
                return (
                  <tr key={a.id} className="hover:bg-tint-cream/50">
                    <RowCheckbox id={a.id} label={a.nickname} />
                    <td className={`${TD} min-w-36`}>
                      <Link href={`${PATH}/${a.id}`} className={LINK}>
                        {a.nickname}
                      </Link>
                      {a.is_admin && <span className="block text-xs text-muted">administrateur</span>}
                    </td>
                    <td className={TD}>{a.full_name}</td>
                    <td className={`${TD} min-w-52 [overflow-wrap:anywhere]`}>{a.email}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {a.birth_date ? `${ageFrom(a.birth_date)} ans` : ""}
                    </td>
                    <td className={TD}>{a.city}</td>
                    <td className={TD}>{a.is_professional ? "Oui" : ""}</td>
                    <td className={TD}>{a.accepts_marketing ? "Oui" : ""}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(a.signed_up_at)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDate(a.last_turn_at)}</td>
                    <td className={TD}>{a.is_blocked ? <Tag tone="warn">Bloqué</Tag> : null}</td>
                    <td className={TD}>
                      <div className="flex flex-nowrap gap-1.5">
                        <Link href={`${PATH}/${a.id}`} className={SMALL_BTN}>
                          Gérer
                        </Link>
                        {!protectedRow &&
                          (a.is_blocked ? (
                            <button type="submit" name="do" value={`debloque:${a.id}`} className={SMALL_BTN}>
                              Débloquer
                            </button>
                          ) : (
                            <ConfirmButton
                              name="do"
                              value={`bloque:${a.id}`}
                              className={SMALL_BTN}
                              message={`Bloquer ${a.nickname} ? Il ne pourra plus se connecter ni écrire.`}
                            >
                              Bloquer
                            </ConfirmButton>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </form>

      <Pagination path={PATH} sp={sp} page={page} pages={pages} total={total} noun={["auteur", "auteurs"]} />
    </div>
  );
}
