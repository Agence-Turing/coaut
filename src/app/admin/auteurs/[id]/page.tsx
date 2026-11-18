import Link from "next/link";
import { notFound } from "next/navigation";
import { authorsAction, renameAuthor, saveAdminNote } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/client";
import { SMALL_BTN_DANGER, Tag } from "@/components/admin/table";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, INPUT, LABEL, LINK, Notice } from "@/components/ui";
import { UUID_RE, formatDate, type AdminAuthorRow } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";
import { ageFrom } from "@/lib/profile";

const SECTION = "flex flex-col gap-4 rounded-2xl border border-line p-4 sm:p-6";
const H2 = "font-display text-2xl font-bold text-ink";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-3 last:border-0">
      <dt className={EYEBROW}>{label}</dt>
      <dd className="mt-1 break-words text-[16px] text-ink">{children || <span className="text-muted">Inconnu</span>}</dd>
    </div>
  );
}

export default async function AdminAuthorPage({ params, searchParams }: PageProps<"/admin/auteurs/[id]">) {
  const { db, userId } = await requireAdminPage();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const { data } = await db.from("admin_authors").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as AdminAuthorRow;
  const back = `/admin/auteurs/${id}`;
  const notice = noticeFrom(sp);
  const deleted = Boolean(a.deleted_at);
  const protectedRow = a.is_admin || a.user_id === userId || deleted;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/auteurs" className={`${LINK} text-sm`}>
          Retour aux auteurs
        </Link>
        <p className={EYEBROW}>Inscrit le {formatDate(a.signed_up_at)}</p>
        <h1 className="font-display text-3xl font-bold leading-tight text-ink">{a.nickname}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {a.is_blocked && <Tag tone="warn">Bloqué depuis le {formatDate(a.blocked_at)}</Tag>}
          {deleted && <Tag tone="warn">Supprimé le {formatDate(a.deleted_at)}</Tag>}
          {a.is_admin && <Tag>Administrateur</Tag>}
          <Link href={`/admin/livres?auteur=${a.id}`} className={LINK}>
            Ses livres ({a.books_count})
          </Link>
          <Link href={`/admin/tours?auteur_id=${a.id}`} className={LINK}>
            Ses tours ({a.turns_count})
          </Link>
        </div>
      </div>

      <Notice info={notice.info} error={notice.error} />

      {!deleted && (
        <section className={SECTION} aria-labelledby="infos">
          <h2 id="infos" className={H2}>
            Informations
          </h2>
          <dl>
            <Row label="Prénom et nom">{a.full_name}</Row>
            <Row label="E-mail">{a.email ?? (a.user_id ? "" : "Pas de compte de connexion")}</Row>
            <Row label="Âge">
              {a.birth_date ? `${ageFrom(a.birth_date)} ans (né le ${formatDate(a.birth_date)})` : ""}
            </Row>
            <Row label="Ville">{[a.city, a.country].filter(Boolean).join(", ")}</Row>
            <Row label="Professionnel">{a.is_professional ? "Oui" : "Non"}</Row>
            <Row label="Newsletter">{a.accepts_marketing ? "Oui" : "Non"}</Row>
            <Row label="Dernière connexion">{formatDate(a.last_sign_in_at)}</Row>
            <Row label="Dernier tour">{formatDate(a.last_turn_at)}</Row>
          </dl>
        </section>
      )}

      {!deleted && (
        <section className={SECTION} aria-labelledby="pseudo">
          <h2 id="pseudo" className={H2}>
            Pseudo
          </h2>
          <form action={renameAuthor} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={a.id} />
            <label className="flex flex-1 flex-col gap-1.5">
              <span className={LABEL}>Pseudo affiché sur ses tours</span>
              <input name="nickname" required minLength={3} maxLength={40} defaultValue={a.nickname} className={INPUT} />
            </label>
            <button type="submit" className={BTN_SECONDARY}>
              Enregistrer
            </button>
          </form>
        </section>
      )}

      {!deleted && (
        <section className={SECTION} aria-labelledby="note">
          <h2 id="note" className={H2}>
            Note interne
          </h2>
          <p className="text-sm text-muted">Visible seulement dans l&apos;administration, jamais par l&apos;auteur.</p>
          <form action={saveAdminNote} className="flex flex-col gap-3">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="id" value={a.id} />
            <label className="sr-only" htmlFor="admin_note">
              Note interne
            </label>
            <textarea
              id="admin_note"
              name="admin_note"
              rows={4}
              maxLength={4000}
              defaultValue={a.admin_note ?? ""}
              className={`${INPUT} min-h-28`}
            />
            <button type="submit" className={`${BTN_PRIMARY} self-start`}>
              Enregistrer la note
            </button>
          </form>
        </section>
      )}

      {!protectedRow && (
        <section className={SECTION} aria-labelledby="compte">
          <h2 id="compte" className={H2}>
            Compte
          </h2>
          <form action={authorsAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="back_after_delete" value="/admin/auteurs" />
            {a.is_blocked ? (
              <button type="submit" name="do" value={`debloque:${a.id}`} className={BTN_SECONDARY}>
                Débloquer
              </button>
            ) : (
              <ConfirmButton
                name="do"
                value={`bloque:${a.id}`}
                className={BTN_SECONDARY}
                message={`Bloquer ${a.nickname} ? Il est déconnecté et ne peut plus se connecter ni écrire.`}
              >
                Bloquer
              </ConfirmButton>
            )}
            <ConfirmButton
              name="do"
              value={`supprime:${a.id}`}
              className={`${SMALL_BTN_DANGER} px-5 text-[15px]`}
              message={`Supprimer ${a.nickname} ? Son compte, son e-mail et son profil sont effacés, sans retour possible. Ses tours restent dans les livres, sous « Auteur supprimé ».`}
            >
              Supprimer l&apos;auteur
            </ConfirmButton>
          </form>
          <p className="text-sm text-muted">
            Bloquer : il est déconnecté, ne peut plus se connecter ni écrire ; tout reste en place.
            Supprimer : compte et données personnelles effacés ; il quitte les livres en cours (le tour
            passe au suivant si c&apos;était le sien) ; ses tours restent, signés « Auteur supprimé ».
          </p>
        </section>
      )}
    </div>
  );
}
