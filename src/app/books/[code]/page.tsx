import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Cta } from "@/components/Buttons";
import { getBook, getTurns, playersOf } from "@/lib/books";
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
  const [book, author] = await Promise.all([getBook(code), getCurrentUser()]);
  if (!book) notFound();
  const turns = await getTurns(book.id);
  const players = playersOf(book);
  const writtenTurns = turns.filter((t) => t.content && t.is_ended);
  const currentTurn = turns.find((t) => !t.is_ended);

  return (
    <>
      <Header user={author} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <Link
              href={book.status === "published" ? "/books?statut=publies" : "/books"}
              className="text-sm text-white/70 hover:text-peche"
            >
              ← Retour à la bibliothèque
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
                  {" · "}
                </>
              ) : null}
              {writtenTurns.length} tour{writtenTurns.length > 1 ? "s" : ""}{" "}
              d&rsquo;écriture
            </p>
            {book.status === "launched" && (
              <div className="mt-6">
                <Cta href={author ? "#" : "/?mode=signup"}>
                  Demander à rejoindre
                </Cta>
              </div>
            )}
          </div>
        </section>

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

          {currentTurn && (
            <p className="mt-10 rounded-2xl bg-peche/20 p-5 text-center text-sm font-semibold text-brand-dark">
              ✍️ C&rsquo;est au tour de{" "}
              {currentTurn.authors?.nickname ?? "un co-auteur"} d&rsquo;écrire la
              suite…
            </p>
          )}

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
