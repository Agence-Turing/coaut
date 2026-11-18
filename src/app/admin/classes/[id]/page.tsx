import Link from "next/link";
import { notFound } from "next/navigation";
import { classesAction } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/client";
import { SMALL_BTN_DANGER, TABLE, TABLE_WRAP, TD, TH, Tag } from "@/components/admin/table";
import { BTN_SECONDARY, EYEBROW, LINK, Notice } from "@/components/ui";
import { STATUS_LABELS, UUID_RE, formatDate, type AdminClassRow } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";

const SECTION = "flex flex-col gap-4 rounded-2xl border border-line p-4 sm:p-6";
const H2 = "font-display text-2xl font-bold text-ink";

export default async function AdminClassPage({ params, searchParams }: PageProps<"/admin/classes/[id]">) {
  const { db } = await requireAdminPage();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;

  const [{ data }, { data: studentsData }, { data: booksData }] = await Promise.all([
    db.from("admin_classes").select("*").eq("id", id).maybeSingle(),
    db
      .from("class_students")
      .select("id, author_id, first_name, code, active, position, created_at")
      .eq("class_id", id)
      .order("active", { ascending: false })
      .order("position")
      .order("first_name"),
    db
      .from("books")
      .select("id, legacy_code, title, status")
      .eq("class_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!data) notFound();
  const c = data as AdminClassRow;
  const students = (studentsData ?? []) as {
    id: string;
    author_id: string;
    first_name: string;
    code: string | null;
    active: boolean;
  }[];
  const books = (booksData ?? []) as { id: string; legacy_code: string | null; title: string; status: string }[];

  // Tours écrits par élève.
  const counts = new Map<string, number>();
  if (students.length) {
    const { data: turns } = await db
      .from("turns")
      .select("author_id")
      .in("author_id", students.map((s) => s.author_id))
      .eq("is_ended", true)
      .not("content", "is", null);
    for (const t of turns ?? []) counts.set(t.author_id as string, (counts.get(t.author_id as string) ?? 0) + 1);
  }

  const back = `/admin/classes/${id}`;
  const notice = noticeFrom(sp);
  const published = books.filter((b) => b.status === "published").length;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/classes" className={`${LINK} text-sm`}>
          Retour aux classes
        </Link>
        <p className={EYEBROW}>Classe créée le {formatDate(c.created_at)}</p>
        <h1 className="font-display text-3xl font-bold leading-tight text-ink">{c.name}</h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            Prof :{" "}
            <Link href={`/admin/auteurs/${c.owner_id}`} className={LINK}>
              {c.owner_nickname}
            </Link>{" "}
            <span className="[overflow-wrap:anywhere]">({c.owner_email})</span>
          </span>
          {c.owner_blocked && <Tag tone="warn">Prof bloqué</Tag>}
          {c.is_blocked && <Tag tone="warn">Classe bloquée depuis le {formatDate(c.blocked_at)}</Tag>}
        </p>
      </div>

      <Notice info={notice.info} error={notice.error} />

      <section className={SECTION} aria-labelledby="eleves">
        <h2 id="eleves" className={H2}>
          Élèves ({c.students_count})
        </h2>
        {students.length === 0 ? (
          <p className="text-muted">Aucun élève.</p>
        ) : (
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    Prénom
                  </th>
                  <th scope="col" className={TH}>
                    Code
                  </th>
                  <th scope="col" className={TH}>
                    Tours écrits
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className={TD}>
                      <Link href={`/admin/tours?auteur_id=${s.author_id}`} className={LINK}>
                        {s.first_name}
                      </Link>
                      {!s.active && <span className="block text-xs text-muted">retiré par le prof</span>}
                    </td>
                    <td className={`${TD} font-mono whitespace-nowrap`}>{s.code ?? ""}</td>
                    <td className={TD}>{counts.get(s.author_id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={SECTION} aria-labelledby="livres">
        <h2 id="livres" className={H2}>
          Livres ({books.length})
        </h2>
        {books.length === 0 ? (
          <p className="text-muted">Aucun livre pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col">
            {books.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2 last:border-0">
                <Link href={`/admin/livres/${b.id}`} className={LINK}>
                  {b.title}
                </Link>
                <Tag>{STATUS_LABELS[b.status] ?? b.status}</Tag>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={SECTION} aria-labelledby="actions">
        <h2 id="actions" className={H2}>
          Actions
        </h2>
        <form action={classesAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="back_after_delete" value="/admin/classes" />
          {c.is_blocked ? (
            <button type="submit" name="do" value={`debloque:${c.id}`} className={BTN_SECONDARY}>
              Débloquer la classe
            </button>
          ) : (
            <ConfirmButton
              name="do"
              value={`bloque:${c.id}`}
              className={BTN_SECONDARY}
              message={`Bloquer la classe ? Ses ${c.students_count} élèves ne pourront plus entrer ni écrire.`}
            >
              Bloquer la classe
            </ConfirmButton>
          )}
          {c.owner_blocked ? (
            <button type="submit" name="do" value={`debloque_prof:${c.id}`} className={BTN_SECONDARY}>
              Débloquer le prof
            </button>
          ) : (
            <ConfirmButton
              name="do"
              value={`bloque_prof:${c.id}`}
              className={BTN_SECONDARY}
              message={`Bloquer ${c.owner_nickname} ? Il ne pourra plus se connecter ni écrire.`}
            >
              Bloquer le prof
            </ConfirmButton>
          )}
          <ConfirmButton
            name="do"
            value={`supprime:${c.id}`}
            className={`${SMALL_BTN_DANGER} px-5 text-[15px]`}
            message={`Supprimer la classe « ${c.name} » ? Les comptes des élèves sont supprimés, ainsi que ses livres non publiés (${books.length - published}). Ses ${published} livres publiés restent dans la bibliothèque.`}
          >
            Supprimer la classe
          </ConfirmButton>
        </form>
        <p className="text-sm text-muted">
          Bloquer la classe : les codes des élèves ne marchent plus, rien n&apos;est effacé. Supprimer : les
          comptes des élèves et les livres non publiés de la classe sont effacés ; les livres publiés
          restent dans la bibliothèque, avec les prénoms des élèves.
        </p>
      </section>
    </div>
  );
}
