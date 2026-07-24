import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JoinRequestForm from "@/components/JoinRequestForm";
import TurnEditor from "@/components/TurnEditor";
import PublishBookButton from "@/components/PublishBookButton";
import { acceptRequest, rejectRequest } from "@/app/books/actions";
import {
  getBook,
  getTurns,
  getJoinRequests,
  getMyJoinRequest,
  playersOf,
  bookRef,
  writingState,
} from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const book = await getBook(code);
  return { title: book ? `${book.title} | Co-Aut` : "Livre introuvable | Co-Aut" };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [book, user] = await Promise.all([getBook(code), getCurrentUser()]);
  if (!book) notFound();
  const turns = await getTurns(book.id);
  const players = playersOf(book);
  const writtenTurns = turns.filter((t) => t.content && t.is_ended);
  const ref = bookRef(book);
  const writing = book.status === "launched" ? writingState(book, turns) : null;

  const isLauncher = Boolean(user?.authorId && book.launcher_id === user.authorId);
  const isPlayer = Boolean(
    user?.authorId && book.book_players.some((p) => p.author_id === user.authorId)
  );
  const teamFull = Boolean(
    book.max_players && book.book_players.length >= book.max_players
  );

  const myTurn = Boolean(
    writing && user?.authorId && writing.currentAuthorId === user.authorId && isPlayer
  );

  const joinRequests = isLauncher ? await getJoinRequests(book.id) : [];
  const pendingRequests = joinRequests.filter((r) => r.status === "pending");
  const myRequest =
    !isLauncher && !isPlayer && user?.authorId
      ? await getMyJoinRequest(book.id, user.authorId)
      : null;

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <Link
              href={book.status === "published" ? "/bibliotheque" : "/books"}
              className="text-sm text-white/70 hover:text-peche"
            >
              {book.status === "published"
                ? "← Retour à la bibliothèque"
                : "← Retour aux livres à rejoindre"}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {book.themes.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-peche"
                >
                  {t}
                </span>
              ))}
              {book.scolar_level && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                  Niveau {book.scolar_level}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  book.status === "published"
                    ? "bg-brand text-white"
                    : "bg-peche text-aubergine"
                }`}
              >
                {book.status === "published" ? "Publié" : "En cours d'écriture"}
              </span>
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">
              {book.title}
            </h1>
            {book.synopsis && (
              <p className="mt-4 text-white/85">{book.synopsis}</p>
            )}
            <p className="mt-6 text-sm text-white/70">
              {players.length > 0 ? (
                <>
                  Écrit par{" "}
                  <span className="font-semibold text-white">
                    {players.join(", ")}
                  </span>
                  {book.max_players
                    ? ` (${book.book_players.length}/${book.max_players} co-auteurs)`
                    : ""}
                  {" · "}
                </>
              ) : null}
              {writtenTurns.length} tour{writtenTurns.length > 1 ? "s" : ""}{" "}
              d&rsquo;écriture
            </p>

            {isLauncher && book.status === "launched" && (
              <div className="mt-6">
                <PublishBookButton bookRef={ref} />
              </div>
            )}

            {book.status === "launched" && !isLauncher && !isPlayer && (
              <div className="mt-8 max-w-xl">
                {myRequest ? (
                  <p className="rounded-2xl bg-white/10 p-5 text-sm font-semibold">
                    {myRequest.status === "pending" &&
                      "✉️ Ta demande est envoyée, le lanceur du livre va te répondre."}
                    {myRequest.status === "accepted" &&
                      "🎉 Ta demande a été acceptée ! Tu fais partie de l'équipe."}
                    {myRequest.status === "rejected" &&
                      "Le lanceur n'a pas retenu ta demande pour ce livre. D'autres histoires t'attendent !"}
                  </p>
                ) : teamFull ? (
                  <p className="rounded-2xl bg-white/10 p-5 text-sm font-semibold">
                    L&rsquo;équipe est au complet pour ce livre.
                  </p>
                ) : (
                  <JoinRequestForm bookId={book.id} bookRef={ref} />
                )}
              </div>
            )}
          </div>
        </section>

        {isLauncher && book.status === "launched" && (
          <section className="border-b border-ink/10 bg-peche/10">
            <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
              <h2 className="font-display text-xl font-bold text-ink">
                Demandes pour rejoindre ton livre
                {pendingRequests.length > 0 && (
                  <span className="ml-2 rounded-full bg-brand px-3 py-1 text-sm text-white">
                    {pendingRequests.length}
                  </span>
                )}
              </h2>

              {joinRequests.length === 0 ? (
                <p className="mt-4 text-sm text-graphite">
                  Personne n&rsquo;a encore demandé à rejoindre ton histoire.
                  Partage-la autour de toi !
                </p>
              ) : (
                <ul className="mt-6 space-y-4">
                  {joinRequests.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-ink/10 bg-white p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-display font-bold text-ink">
                          ✍️ {r.authors?.nickname ?? "Auteur inconnu"}
                        </p>
                        {r.status === "pending" ? (
                          <div className="flex gap-2">
                            <form action={acceptRequest}>
                              <input type="hidden" name="request_id" value={r.id} />
                              <input type="hidden" name="book_ref" value={ref} />
                              <button
                                type="submit"
                                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                              >
                                Accepter
                              </button>
                            </form>
                            <form action={rejectRequest}>
                              <input type="hidden" name="request_id" value={r.id} />
                              <input type="hidden" name="book_ref" value={ref} />
                              <button
                                type="submit"
                                className="rounded-full border-2 border-ink/20 px-5 py-2 text-sm font-bold text-ink transition-colors hover:border-brand-dark hover:text-brand-dark"
                              >
                                Refuser
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              r.status === "accepted"
                                ? "bg-brand/10 text-brand-dark"
                                : "bg-ink/5 text-graphite"
                            }`}
                          >
                            {r.status === "accepted" ? "Accepté ✓" : "Refusé"}
                          </span>
                        )}
                      </div>
                      {r.message && (
                        <p className="mt-3 text-sm italic text-graphite">
                          &ldquo;{r.message}&rdquo;
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          {writtenTurns.length === 0 ? (
            <p className="text-center text-graphite">
              L&rsquo;histoire n&rsquo;a pas encore commencé… Elle attend ses
              co-auteurs !
            </p>
          ) : (
            <article className="space-y-8">
              {writtenTurns.map((t) => (
                <div key={t.id}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
                    Tour {t.number}
                    {t.authors?.nickname ? ` — ${t.authors.nickname}` : ""}
                  </p>
                  <div className="space-y-4 leading-relaxed text-ink">
                    {t.content!.split("\n\n").map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </article>
          )}

          {writing &&
            (myTurn ? (
              <div className="mt-10">
                <TurnEditor
                  bookRef={ref}
                  turnNumber={writing.number}
                  draft={writing.openTurn?.content ?? ""}
                />
              </div>
            ) : (
              <p className="mt-10 rounded-2xl bg-peche/20 p-5 text-center text-sm font-semibold text-brand-dark">
                {isPlayer ? "🔒 " : ""}✍️ C&rsquo;est au tour de{" "}
                {writing.currentNickname ?? "un co-auteur"} d&rsquo;écrire la
                suite…
                {isPlayer && " Tu seras prévenu quand ce sera ton tour."}
              </p>
            ))}

          {book.status === "published" && (
            <p className="mt-10 text-center">
              <span className="font-display font-bold">Fin</span>
            </p>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
