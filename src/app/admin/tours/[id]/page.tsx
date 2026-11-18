import Link from "next/link";
import { notFound } from "next/navigation";
import { turnsAction, updateTurn } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/client";
import { ModerationCell, SMALL_BTN_DANGER, Tag } from "@/components/admin/table";
import { BTN_PRIMARY, EYEBROW, INPUT, LINK, Notice } from "@/components/ui";
import { UUID_RE, formatDate } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";

type TurnDetail = {
  id: string;
  book_id: string;
  legacy_code: string | null;
  book_title: string;
  number: number;
  author_id: string | null;
  author_nickname: string | null;
  created_at: string;
  is_ended: boolean;
  content: string | null;
  moderation_status: string | null;
  moderation_reason: string | null;
};

export default async function AdminTurnPage({ params, searchParams }: PageProps<"/admin/tours/[id]">) {
  const { db } = await requireAdminPage();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;
  const { data } = await db
    .from("admin_turns")
    .select(
      "id, book_id, legacy_code, book_title, number, author_id, author_nickname, created_at, is_ended, content, moderation_status, moderation_reason"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const t = data as TurnDetail;
  const back = `/admin/tours/${id}`;
  const notice = noticeFrom(sp);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/admin/tours?livre_id=${t.book_id}&tri=numero&ordre=asc`} className={`${LINK} text-sm`}>
          Tous les tours de ce livre
        </Link>
        <p className={EYEBROW}>
          Tour {t.number} · {formatDate(t.created_at)}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight text-ink">
          <Link href={`/admin/livres/${t.book_id}`} className="hover:text-link">
            {t.book_title}
          </Link>
        </h1>
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            par{" "}
            {t.author_id ? (
              <Link href={`/admin/auteurs/${t.author_id}`} className={LINK}>
                {t.author_nickname}
              </Link>
            ) : (
              "un auteur inconnu"
            )}
          </span>
          {!t.is_ended && <Tag tone="soft">Brouillon en cours</Tag>}
          <ModerationCell status={t.moderation_status} reason={t.moderation_reason} />
        </p>
      </div>

      <Notice info={notice.info} error={notice.error} />

      <form action={updateTurn} className="flex flex-col gap-3">
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="id" value={t.id} />
        <label htmlFor="content" className="text-sm font-semibold text-ink">
          Texte du tour
        </label>
        <textarea
          id="content"
          name="content"
          rows={16}
          required
          defaultValue={t.content ?? ""}
          className={`${INPUT} min-h-80 font-display text-[17px] leading-relaxed`}
        />
        <button type="submit" className={`${BTN_PRIMARY} self-start`}>
          Enregistrer le texte
        </button>
      </form>

      <form action={turnsAction} className="flex flex-col gap-2 border-t border-line pt-5">
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="back_after_delete" value={`/admin/tours?livre_id=${t.book_id}&tri=numero&ordre=asc`} />
        <ConfirmButton
          name="do"
          value={`supprime:${t.id}`}
          className={`${SMALL_BTN_DANGER} self-start px-5 text-[15px]`}
          message={`Supprimer le tour ${t.number} ? Les tours suivants sont renumérotés, l'auteur dont c'est le tour ne change pas.`}
        >
          Supprimer ce tour
        </ConfirmButton>
        <p className="text-sm text-muted">
          Les tours suivants sont renumérotés ; l&apos;auteur dont c&apos;est le tour ne change pas.
        </p>
      </form>
    </div>
  );
}
