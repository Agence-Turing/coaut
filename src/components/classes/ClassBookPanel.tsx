import Link from "next/link";
import { reorderTeam, reviewTurn, skipTurn } from "@/app/classes/actions";
import { ConfirmButton } from "@/components/classes/ClassForms";
import { BTN_PRIMARY, BTN_SECONDARY, LINK } from "@/components/ui";
import type { Turn } from "@/lib/books";
import { deName } from "@/lib/fr";

const ARROW_BTN =
  "inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong bg-paper text-ink hover:border-ink disabled:opacity-40";

/** Panneau du prof sur un livre de sa classe en cours : relecture, tour d'un absent, ordre de passage. */
export default function ClassBookPanel({
  bookRef,
  classId,
  team,
  currentAuthorId,
  currentNickname,
  pendingReview,
}: {
  bookRef: string;
  classId: string;
  team: { author_id: string; nickname: string }[];
  currentAuthorId: string | null;
  currentNickname: string | null;
  pendingReview: Turn | null;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold leading-tight">Ta classe</h2>
        <Link href={`/classes/${classId}`} className={`${LINK} inline-flex min-h-11 items-center text-[15px]`}>
          Codes des élèves
        </Link>
      </div>

      {pendingReview && (
        <div className="flex flex-col gap-3 rounded-xl bg-tint-cream p-4">
          <p className="text-[15px] font-semibold text-ink">
            Tour {pendingReview.number} {pendingReview.authors?.nickname ? deName(pendingReview.authors.nickname) : "de l'élève"}, à relire
          </p>
          <div className="flex flex-col gap-3 font-display text-lg leading-relaxed text-ink">
            {(pendingReview.content ?? "").split("\n\n").map((p, i) => (
              <p key={i} className="whitespace-pre-line break-words">
                {p}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={reviewTurn}>
              <input type="hidden" name="book_ref" value={bookRef} />
              <input type="hidden" name="turn_id" value={pendingReview.id} />
              <input type="hidden" name="decision" value="approve" />
              <button type="submit" className={BTN_PRIMARY}>
                Valider ce tour
              </button>
            </form>
            <form action={reviewTurn}>
              <input type="hidden" name="book_ref" value={bookRef} />
              <input type="hidden" name="turn_id" value={pendingReview.id} />
              <input type="hidden" name="decision" value="rework" />
              <button type="submit" className={BTN_SECONDARY}>
                Rendre à l&rsquo;élève pour qu&rsquo;il le reprenne
              </button>
            </form>
          </div>
        </div>
      )}

      {!pendingReview && currentAuthorId && currentNickname && (
        <form action={skipTurn} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="book_ref" value={bookRef} />
          <p className="text-[15px] text-muted">
            C&rsquo;est au tour {deName(currentNickname).startsWith("d'") ? "d’" : "de "}<strong className="font-semibold text-ink">{currentNickname}</strong>.
          </p>
          <ConfirmButton
            message={`Passer le tour ${deName(currentNickname)} ? Son brouillon éventuel sera effacé et la plume passera au suivant.`}
            className={BTN_SECONDARY}
          >
            Passer son tour (absent)
          </ConfirmButton>
        </form>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-ink">Ordre de passage</h3>
          <form action={reorderTeam}>
            <input type="hidden" name="book_ref" value={bookRef} />
            <input type="hidden" name="move" value="shuffle" />
            <button type="submit" className={BTN_SECONDARY}>
              Mélanger
            </button>
          </form>
        </div>
        <ol className="flex flex-col">
          {team.map((p, i) => (
            <li
              key={p.author_id}
              className="flex items-center justify-between gap-3 border-b border-line py-1.5 last:border-0"
            >
              <span className="min-w-0 break-words text-[15px]">
                <span className="mr-2 text-muted">{i + 1}.</span>
                <span className={p.author_id === currentAuthorId ? "font-semibold" : ""}>{p.nickname}</span>
              </span>
              <span className="flex gap-1.5">
                <form action={reorderTeam}>
                  <input type="hidden" name="book_ref" value={bookRef} />
                  <input type="hidden" name="author_id" value={p.author_id} />
                  <input type="hidden" name="move" value="up" />
                  <button type="submit" disabled={i === 0} aria-label={`Faire passer ${p.nickname} plus tôt`} className={ARROW_BTN}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </form>
                <form action={reorderTeam}>
                  <input type="hidden" name="book_ref" value={bookRef} />
                  <input type="hidden" name="author_id" value={p.author_id} />
                  <input type="hidden" name="move" value="down" />
                  <button type="submit" disabled={i === team.length - 1} aria-label={`Faire passer ${p.nickname} plus tard`} className={ARROW_BTN}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
