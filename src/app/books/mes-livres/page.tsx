import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard, { BookShelf } from "@/components/BookCard";
import { LINK, PageHeading } from "@/components/ui";
import {
  listMyBooks,
  listMyRequests,
  listMyFavorites,
  getCurrentWriters,
  getFavoriteCounts,
  getCoverPaths,
  bookRef,
} from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mes livres | Co-Aut",
};

const REQUEST_LABEL = {
  pending: { text: "En attente de réponse", cls: "bg-tint-orange text-ink" },
  accepted: { text: "Acceptée", cls: "bg-surface text-ink" },
  rejected: { text: "Non retenue", cls: "bg-surface text-muted" },
} as const;

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-baseline gap-3 border-t border-line pt-8 font-display text-[28px] font-bold leading-tight tracking-tight">
      {children}
      {count !== undefined && count > 0 && (
        <span className="font-sans text-base font-medium text-subtle">{count}</span>
      )}
    </h2>
  );
}

export default async function MyBooksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");

  const [books, requests, favorites] = user.authorId
    ? await Promise.all([
        listMyBooks(user.authorId),
        listMyRequests(user.authorId),
        listMyFavorites(user.authorId),
      ])
    : [[], [], []];

  const writing = books.filter((b) => b.status === "launched");
  const published = books.filter((b) => b.status === "published");
  const [currentWriters, favCounts, covers] = await Promise.all([
    getCurrentWriters(writing),
    getFavoriteCounts(favorites.map((b) => b.id)),
    getCoverPaths([...books, ...favorites].map((b) => b.id)),
  ]);
  const pendingRequests = requests.filter((r) => r.status !== "accepted");
  // Les livres où c'est à moi d'écrire passent devant.
  const writingSorted = writing
    .slice()
    .sort(
      (a, b) =>
        Number(currentWriters.get(b.id) === user.authorId) -
        Number(currentWriters.get(a.id) === user.authorId),
    );
  const myTurnCount = writing.filter(
    (b) => currentWriters.get(b.id) === user.authorId,
  ).length;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          title="Mes livres"
          intro={
            myTurnCount > 0
              ? `C'est à toi d'écrire dans ${myTurnCount} livre${myTurnCount > 1 ? "s" : ""}.`
              : "Les histoires que tu écris, celles que tu as publiées et tes demandes en cours."
          }
        />

        <SectionTitle count={writing.length}>En cours d&rsquo;écriture</SectionTitle>
        {writing.length === 0 ? (
          <p className="text-[17px] text-muted">
            Tu n&rsquo;écris aucun livre pour le moment.{" "}
            <Link href="/books/new" className={LINK}>
              Lance ton histoire
            </Link>{" "}
            ou{" "}
            <Link href="/books" className={LINK}>
              rejoins une équipe
            </Link>
            .
          </p>
        ) : (
          <BookShelf>
            {writingSorted.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                coverPath={covers.get(b.id)}
                flags={{
                  launcher: b.launcher_id === user.authorId,
                  myTurn: currentWriters.get(b.id) === user.authorId,
                }}
              />
            ))}
          </BookShelf>
        )}

        <SectionTitle count={published.length}>Publiés</SectionTitle>
        {published.length === 0 ? (
          <p className="text-[17px] text-muted">
            Aucun livre publié pour l&rsquo;instant.
          </p>
        ) : (
          <BookShelf>
            {published.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                coverPath={covers.get(b.id)}
                flags={{ launcher: b.launcher_id === user.authorId }}
              />
            ))}
          </BookShelf>
        )}

        <SectionTitle count={favorites.length}>Mes favoris</SectionTitle>
        {favorites.length === 0 ? (
          <p className="text-[17px] text-muted">
            Aucun favori pour l&rsquo;instant. Explore{" "}
            <Link href="/bibliotheque" className={LINK}>
              la bibliothèque
            </Link>{" "}
            et garde les livres que tu aimes.
          </p>
        ) : (
          <BookShelf>
            {favorites.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                coverPath={covers.get(b.id)}
                favCount={favCounts.get(b.id) ?? 0}
              />
            ))}
          </BookShelf>
        )}

        {pendingRequests.length > 0 && (
          <>
            <SectionTitle count={pendingRequests.length}>Mes demandes</SectionTitle>
            <ul className="flex flex-col">
              {pendingRequests.map((r) => {
                const label = REQUEST_LABEL[r.status];
                return (
                  <li key={r.id} className="border-b border-line">
                    <Link
                      href={r.books ? `/books/${bookRef(r.books)}` : "/books"}
                      className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3 hover:text-link"
                    >
                      <span className="min-w-0 break-words font-display text-xl font-bold">
                        {r.books?.title ?? "Livre supprimé"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${label.cls}`}
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
      </main>
      <Footer />
    </>
  );
}
