import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JoinRequestForm from "@/components/JoinRequestForm";
import TurnEditor from "@/components/TurnEditor";
import PublishBookButton from "@/components/PublishBookButton";
import FavoriteButton from "@/components/FavoriteButton";
import ClassBookPanel from "@/components/classes/ClassBookPanel";
import BookCover from "@/components/BookCover";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, LINK, Notice } from "@/components/ui";
import { acceptRequest, rejectRequest } from "@/app/books/actions";
import {
  getBook,
  openToJoin,
  getTurns,
  getJoinRequests,
  getMyJoinRequest,
  getFavoriteCounts,
  getMyFavoriteIds,
  bookRef,
  pendingReviewOf,
  placesLeft,
  writingState,
  shownTurns,
  splitTitle,
  type Turn,
} from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";
import { deName } from "@/lib/fr";
import { navFromHref } from "@/lib/nav";
import { niveauLabel } from "@/lib/niveaux";

/** Au-delà de ce nombre de tours écrits, les premiers sont repliés (livre en cours). */
const FOLD_ABOVE = 5;
const KEEP_OPEN = 3;

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const book = await getBook(code);
  return { title: book ? `${book.title} | Co-Aut` : "Livre introuvable | Co-Aut" };
}

/** Une étape du fil : la pastille et son trait à gauche, le contenu à droite. */
function Step({
  marker,
  tone = "ink",
  last = false,
  children,
}: {
  marker: React.ReactNode;
  tone?: "ink" | "brand" | "dashed" | "outline";
  last?: boolean;
  children: React.ReactNode;
}) {
  const circle = {
    ink: "bg-ink text-paper",
    brand: "bg-brand text-ink",
    dashed: "border border-dashed border-subtle text-muted",
    outline: "border-2 border-brand text-ink",
  }[tone];
  return (
    <div className="flex gap-4 sm:gap-5">
      <div className="flex w-10 flex-none flex-col items-center sm:w-11">
        <div
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full font-display text-lg font-bold sm:h-11 sm:w-11 ${circle}`}
        >
          {marker}
        </div>
        {!last && <div className="w-0.5 flex-1 bg-line" />}
      </div>
      <div className={`min-w-0 flex-1 pt-1.5 ${last ? "" : "pb-9"}`}>{children}</div>
    </div>
  );
}

function TurnStep({ turn }: { turn: Turn }) {
  return (
    <Step marker={turn.number}>
      <p className="text-sm text-muted">
        {turn.authors?.nickname && (
          <strong className="font-semibold text-ink">{turn.authors.nickname}</strong>
        )}
        {turn.authors?.nickname ? " · " : ""}
        <time dateTime={turn.created_at}>{DATE_FR.format(new Date(turn.created_at))}</time>
      </p>
      <div className="mt-2.5 flex flex-col gap-4 font-display text-xl leading-relaxed text-ink">
        {turn.content!.split("\n\n").map((p, i) => (
          <p key={i} className="whitespace-pre-line break-words">
            {p}
          </p>
        ))}
      </div>
    </Step>
  );
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { code } = await params;
  const { from } = await searchParams;
  const [book, user] = await Promise.all([getBook(code), getCurrentUser()]);
  if (!book) notFound();
  const turns = await getTurns(book.id);
  // Ordre de passage, affiché à partir du lanceur : les positions tournent (la rotation des
  // tours se recale quand l'administration supprime un tour ou retire un co-auteur), l'ordre
  // cyclique, lui, ne change pas.
  const byPosition = book.book_players.slice().sort((a, b) => a.position - b.position);
  const launcherIdx = byPosition.findIndex((p) => p.author_id === book.launcher_id);
  const team =
    launcherIdx > 0
      ? [...byPosition.slice(launcherIdx), ...byPosition.slice(0, launcherIdx)]
      : byPosition;
  const writtenTurns = shownTurns(book, turns);
  // Livre réservé à une classe : pas de demandes à rejoindre, pas de mail aux élèves.
  const isClassBook = Boolean(book.class_id);
  const isStudent = Boolean(user?.isStudent);
  const ref = bookRef(book);
  const published = book.status === "published";
  const writing = book.status === "launched" ? writingState(book, turns) : null;

  const isLauncher = Boolean(user?.authorId && book.launcher_id === user.authorId);
  const isPlayer = Boolean(
    user?.authorId && book.book_players.some((p) => p.author_id === user.authorId)
  );
  const teamFull = Boolean(
    book.max_players && book.book_players.length >= book.max_players
  );
  // Places encore libres dans un livre public : la suite attend que l'équipe soit au complet.
  const openPlaces =
    !isClassBook && book.max_players
      ? Math.max(book.max_players - book.book_players.length, 0)
      : 0;
  const waiting = writing?.waitingForTeam ?? null;

  // Onglet du menu : celui de la liste d'où l'on vient (?from=…), sinon le plus
  // probable pour ce livre et ce lecteur.
  const navActive = isStudent
    ? "/classe/livres"
    : (navFromHref(from) ??
      (isClassBook && isLauncher
        ? "/classes"
        : isLauncher || isPlayer
          ? "/books/mes-livres"
          : published
            ? "/bibliotheque"
            : "/books"));

  // Lien du haut : vers la liste de l'onglet souligné (on revient d'où l'on vient).
  const back =
    navActive === "/classe/livres"
      ? { href: navActive, label: "← Les livres de ma classe" }
      : navActive === "/classes"
        ? isClassBook && isLauncher
          ? { href: `/classes/${book.class_id}`, label: "← Ma classe" }
          : { href: navActive, label: "← Mes classes" }
        : navActive === "/books/mes-livres"
          ? { href: navActive, label: "← Retour à mes livres" }
          : navActive === "/bibliotheque"
            ? { href: navActive, label: "← Retour à la bibliothèque" }
            : { href: "/books", label: "← Retour aux livres à rejoindre" };

  // « Publier » seulement quand publishBook l'accepterait : au moins un tour écrit, pas de tour
  // en relecture, pas le tour en cours d'un autre, et (livre public) au moins deux auteurs.
  const endedTurns = turns.filter((t) => t.is_ended && t.content);
  const openTurn = turns.find((t) => !t.is_ended);
  const writers = new Set(endedTurns.map((t) => t.author_id));
  if (openTurn?.content?.trim()) writers.add(openTurn.author_id);
  const canPublish =
    isLauncher &&
    book.status === "launched" &&
    endedTurns.length > 0 &&
    !pendingReviewOf(book, turns) &&
    (!openTurn || openTurn.author_id === user?.authorId) &&
    (isClassBook || writers.size >= 2);

  const myTurn = Boolean(
    writing && user?.authorId && writing.currentAuthorId === user.authorId && isPlayer
  );

  const joinRequests = isLauncher && !isClassBook ? await getJoinRequests(book.id) : [];
  const pendingRequests = joinRequests.filter((r) => r.status === "pending");
  const answeredRequests = joinRequests.filter((r) => r.status !== "pending");
  const myRequest =
    !isLauncher && !isPlayer && user?.authorId
      ? await getMyJoinRequest(book.id, user.authorId)
      : null;

  const favCounts = published ? await getFavoriteCounts([book.id]) : null;
  const myFavorites =
    published && user?.authorId ? await getMyFavoriteIds(user.authorId) : null;

  // Qui écrira après l'auteur en cours (rotation de l'équipe).
  const currentIndex = writing
    ? team.findIndex((p) => p.author_id === writing.currentAuthorId)
    : -1;
  const nextNickname =
    currentIndex >= 0 && team.length > 1
      ? (team[(currentIndex + 1) % team.length].authors?.nickname ?? null)
      : null;

  const fold = !published && writtenTurns.length > FOLD_ABOVE;
  const folded = fold ? writtenTurns.slice(0, -KEEP_OPEN) : [];
  const shown = fold ? writtenTurns.slice(-KEEP_OPEN) : writtenTurns;

  const heading = splitTitle(book.title);
  const facts = [
    ...book.themes,
    book.scolar_level ? `Niveau ${niveauLabel(book.scolar_level, ", ")}` : null,
    isClassBook && !published ? "Réservé à la classe" : null,
    published ? "Publié" : openToJoin(book) ? "Équipe à rejoindre" : "En cours d'écriture",
  ].filter(Boolean);

  return (
    <>
      <Header user={user} activeHref={navActive} />
      <main className="mx-auto flex w-full max-w-[800px] flex-1 flex-col gap-10 px-4 pb-20 pt-10 sm:px-6">
        <div className="flex flex-col gap-5">
          <Link
            href={back.href}
            className={`${LINK} inline-flex min-h-11 items-center self-start text-[15px]`}
          >
            {back.label}
          </Link>

          <div className="w-24 sm:w-28">
            <BookCover seed={book.legacy_code ?? book.id} title={heading.main} size="page" />
          </div>

          <p className={EYEBROW}>{facts.join(" · ")}</p>
          <h1 className="break-words font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-[50px]">
            {heading.main}
          </h1>
          {(heading.volume || heading.written) && (
            <p className="-mt-2 text-[17px] text-muted">
              {[heading.volume, heading.written].filter(Boolean).join(" · ")}
            </p>
          )}
          {book.synopsis && (
            <p className="whitespace-pre-line text-[17px] leading-relaxed text-muted">
              {book.synopsis}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-[15px]">
            {team.map((p) => {
              const current = Boolean(writing && p.author_id === writing.currentAuthorId);
              const me = Boolean(user?.authorId && p.author_id === user.authorId);
              return (
                <span
                  key={p.author_id}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 ${
                    current ? "bg-tint-orange font-semibold" : "bg-surface"
                  }`}
                >
                  {p.authors?.nickname ?? "Auteur"}
                  {p.author_id === book.launcher_id && (
                    <span className="ml-1 font-normal text-muted">· lanceur</span>
                  )}
                  {current && (
                    <span className="ml-1">{me ? "· à toi" : "· écrit"}</span>
                  )}
                </span>
              );
            })}
            <span className="ml-1 text-muted">
              {book.max_players
                ? `${team.length}/${book.max_players} co-auteurs · `
                : ""}
              {writtenTurns.length} tour{writtenTurns.length > 1 ? "s" : ""} écrit
              {writtenTurns.length > 1 ? "s" : ""}
            </span>
          </div>

          {canPublish && <PublishBookButton bookRef={ref} />}

          {published && user?.authorId && !isStudent && (
            <FavoriteButton
              bookId={book.id}
              bookRef={ref}
              isFavorite={myFavorites?.has(book.id) ?? false}
              count={favCounts?.get(book.id) ?? 0}
            />
          )}
        </div>

        {book.status === "launched" && !isLauncher && !isPlayer && !isClassBook && (
          <section className="rounded-2xl border border-line p-5 sm:p-6">
            {myRequest ? (
              <Notice
                info={
                  myRequest.status === "pending"
                    ? "Ta demande est envoyée. Le lanceur du livre va te répondre."
                    : myRequest.status === "accepted"
                      ? "Ta demande a été acceptée : tu fais partie de l'équipe."
                      : "Le lanceur n'a pas retenu ta demande pour ce livre. D'autres histoires t'attendent."
                }
              />
            ) : teamFull ? (
              <p className="text-[15px] font-medium text-muted">
                L&rsquo;équipe est au complet pour ce livre.
              </p>
            ) : (
              <JoinRequestForm bookId={book.id} bookRef={ref} />
            )}
          </section>
        )}

        {isLauncher && isClassBook && book.status === "launched" && writing && (
          <ClassBookPanel
            bookRef={ref}
            classId={book.class_id!}
            team={team.map((p) => ({ author_id: p.author_id, nickname: p.authors?.nickname ?? "Élève" }))}
            currentAuthorId={writing.currentAuthorId}
            currentNickname={writing.currentNickname}
            pendingReview={writing.pendingReview ?? null}
          />
        )}

        {isLauncher && !isClassBook && book.status === "launched" && (
          <section className="rounded-2xl border border-line p-5 sm:p-6">
            <h2 className="flex items-center gap-3 font-display text-2xl font-bold leading-tight">
              Demandes pour rejoindre ton livre
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-brand px-2.5 py-0.5 font-sans text-sm font-semibold text-ink">
                  {pendingRequests.length}
                </span>
              )}
            </h2>

            {joinRequests.length === 0 && (
              <p className="mt-3 text-[15px] text-muted">
                Personne n&rsquo;a encore demandé à rejoindre ton histoire.
              </p>
            )}
            {joinRequests.length > 0 && pendingRequests.length === 0 && (
              <p className="mt-3 text-[15px] text-muted">
                Aucune demande en attente.
              </p>
            )}

            {pendingRequests.length > 0 && (
              <ul className="mt-2 flex flex-col">
                {pendingRequests.map((r) => (
                  <li key={r.id} className="border-b border-line py-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold">
                        {r.authors?.nickname ?? "Auteur inconnu"}
                      </p>
                      <div className="flex gap-2">
                        <form action={acceptRequest}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="book_ref" value={ref} />
                          <button type="submit" className={BTN_PRIMARY}>
                            Accepter
                          </button>
                        </form>
                        <form action={rejectRequest}>
                          <input type="hidden" name="request_id" value={r.id} />
                          <input type="hidden" name="book_ref" value={ref} />
                          <button type="submit" className={BTN_SECONDARY}>
                            Refuser
                          </button>
                        </form>
                      </div>
                    </div>
                    {r.message && (
                      <p className="mt-2 break-words font-display text-lg italic leading-relaxed text-muted">
                        «&nbsp;{r.message}&nbsp;»
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {answeredRequests.length > 0 && (
              <details className="mt-4">
                <summary className={`${LINK} inline-flex min-h-11 list-none items-center text-[15px]`}>
                  Demandes déjà traitées ({answeredRequests.length})
                </summary>
                <ul className="flex flex-col">
                  {answeredRequests.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0 last:pb-0"
                    >
                      <p className="font-semibold">
                        {r.authors?.nickname ?? "Auteur inconnu"}
                      </p>
                      <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-muted">
                        {r.status === "accepted" ? "Acceptée" : "Refusée"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <section aria-label="L'histoire, tour par tour" className="flex flex-col">
          {writtenTurns.length === 0 && (
            <Step marker="1" tone="dashed" last={!writing}>
              <p className="text-[17px] text-muted">
                L&rsquo;histoire n&rsquo;a pas encore commencé.
              </p>
            </Step>
          )}

          {fold && (
            <details className="group">
              <summary className="list-none">
                <span className="group-open:hidden">
                  <Step
                    marker={<span className="font-sans text-xs font-semibold">1–{folded.length}</span>}
                    tone="dashed"
                  >
                    <span className={`${LINK} inline-flex min-h-8 items-center text-[15px]`}>
                      Afficher les {folded.length} premiers tours
                    </span>
                  </Step>
                </span>
              </summary>
              {folded.map((t) => (
                <TurnStep key={t.id} turn={t} />
              ))}
            </details>
          )}

          {shown.map((t) => (
            <TurnStep key={t.id} turn={t} />
          ))}

          {writing &&
            (myTurn && user ? (
              <>
                <Step marker={writing.number} tone="brand" last={!nextNickname}>
                  <TurnEditor
                    key={writing.number}
                    bookRef={ref}
                    number={writing.number}
                    draft={writing.openTurn?.content ?? ""}
                    nickname={user.nickname}
                  />
                </Step>
                {openPlaces > 0 && book.max_players ? (
                  <Step marker={writing.number + 1} tone="dashed" last>
                    <p className="text-[15px] text-muted">
                      Ensuite : la suite s&rsquo;écrit quand l&rsquo;équipe est au complet (
                      {placesLeft({ size: book.max_players, missing: openPlaces })}).
                    </p>
                  </Step>
                ) : nextNickname && (
                  <Step marker={writing.number + 1} tone="dashed" last>
                    <p className="text-[15px] text-muted">
                      Ensuite :{" "}
                      <strong className="font-semibold text-ink">{nextNickname}</strong>
                      {isClassBook ? "." : ", prévenu par mail dès que tu as terminé."}
                    </p>
                  </Step>
                )}
              </>
            ) : (
              <Step marker={writing.number} tone="outline" last>
                {waiting ? (
                  <>
                    <p className="text-[17px] font-medium">
                      {isLauncher ? "En attente de ton équipe" : "En attente de l'équipe"}
                      {" "}: {placesLeft(waiting)}.
                    </p>
                    <p className="mt-1 text-[15px] text-muted">
                      {isLauncher
                        ? "Co-Aut s'écrit à plusieurs : la suite s'écrit dès que l'équipe est au complet. Accepte les demandes pour rejoindre ton livre."
                        : isPlayer
                          ? "La suite s'écrit dès que l'équipe est au complet. Tu recevras un mail quand ce sera ton tour."
                          : "La suite s'écrit dès que l'équipe est au complet."}
                    </p>
                  </>
                ) : (
                <>
                <p className="text-[17px] font-medium">
                  {writing.pendingReview
                    ? `Le tour ${deName(writing.pendingReview.authors?.nickname ?? "l'élève")} est en relecture par l'enseignant.`
                    : writing.currentNickname
                      ? `C'est au tour ${deName(writing.currentNickname)} d'écrire la suite.`
                      : "L'histoire attend ses co-auteurs."}
                </p>
                {isPlayer && writing.currentNickname && (
                  <p className="mt-1 text-[15px] text-muted">
                    {isClassBook
                      ? "Reviens plus tard : « À toi d'écrire » s'affichera sur la page de ta classe."
                      : "Tu recevras un mail quand ce sera ton tour."}
                  </p>
                )}
                </>
                )}
              </Step>
            ))}

          {published && writtenTurns.length > 0 && (
            <Step marker={<span className="font-sans text-xs font-semibold">Fin</span>} tone="dashed" last>
              <p className="text-[15px] text-muted">
                Livre terminé en {writtenTurns.length} tour
                {writtenTurns.length > 1 ? "s" : ""}.
              </p>
            </Step>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
