import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard from "@/components/BookCard";
import {
  listMyBooks,
  listMyRequests,
  getCurrentWriters,
  bookRef,
} from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mes livres | Co-Aut",
};

const REQUEST_LABEL = {
  pending: { text: "En attente de réponse", cls: "bg-peche/30 text-brand-dark" },
  accepted: { text: "Acceptée ✓", cls: "bg-brand/10 text-brand-dark" },
  rejected: { text: "Refusée", cls: "bg-ink/5 text-graphite" },
} as const;

export default async function MyBooksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");

  const [books, requests] = user.authorId
    ? await Promise.all([listMyBooks(user.authorId), listMyRequests(user.authorId)])
    : [[], []];

  const writing = books.filter((b) => b.status === "launched");
  const published = books.filter((b) => b.status === "published");
  const currentWriters = await getCurrentWriters(writing);
  const pendingRequests = requests.filter((r) => r.status !== "accepted");

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Mes <span className="text-brand">livres</span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Les histoires que tu écris, celles que tu as publiées et tes
              demandes en cours.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <h2 className="font-display text-2xl font-bold text-ink">
            ✍️ En cours d&rsquo;écriture
          </h2>
          {writing.length === 0 ? (
            <p className="mt-4 text-graphite">
              Tu n&rsquo;écris aucun livre pour le moment.{" "}
              <Link href="/books/new" className="font-bold text-brand hover:underline">
                Lance ton histoire
              </Link>{" "}
              ou{" "}
              <Link href="/books" className="font-bold text-brand hover:underline">
                rejoins une équipe
              </Link>
              .
            </p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {writing.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  flags={{
                    launcher: b.launcher_id === user.authorId,
                    myTurn: currentWriters.get(b.id) === user.authorId,
                  }}
                />
              ))}
            </div>
          )}

          <h2 className="mt-14 font-display text-2xl font-bold text-ink">
            📚 Publiés
          </h2>
          {published.length === 0 ? (
            <p className="mt-4 text-graphite">
              Aucun livre publié pour l&rsquo;instant — la fin de ta première
              histoire approche peut-être !
            </p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {published.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  flags={{ launcher: b.launcher_id === user.authorId }}
                />
              ))}
            </div>
          )}

          {pendingRequests.length > 0 && (
            <>
              <h2 className="mt-14 font-display text-2xl font-bold text-ink">
                ✉️ Mes demandes
              </h2>
              <ul className="mt-6 space-y-3">
                {pendingRequests.map((r) => {
                  const label = REQUEST_LABEL[r.status];
                  return (
                    <li key={r.id}>
                      <Link
                        href={r.books ? `/books/${bookRef(r.books)}` : "/books"}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white p-5 transition-colors hover:border-brand/40"
                      >
                        <span className="font-display font-bold text-ink">
                          {r.books?.title ?? "Livre supprimé"}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${label.cls}`}
                        >
                          {label.text}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
