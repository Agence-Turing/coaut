import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard from "@/components/BookCard";
import BookFiltersBar from "@/components/BookFilters";
import { listBooks, getFilterOptions, type BookFilters } from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Rejoindre un livre | Co-Aut",
  description:
    "Découvre les histoires en cours d'écriture et rejoins une équipe de co-auteurs sur Co-Aut.",
};

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; theme?: string; niveau?: string }>;
}) {
  const filters: BookFilters = await searchParams;
  const [books, options, user] = await Promise.all([
    listBooks("launched", filters),
    getFilterOptions("launched"),
    getCurrentUser(),
  ]);

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold md:text-4xl">
                  Rejoindre <span className="text-brand">un livre</span>
                </h1>
                <p className="mt-3 max-w-2xl text-white/85">
                  Des histoires en cours d&rsquo;écriture cherchent leurs
                  co-auteurs. Trouve celle qui te fait rêver et demande à
                  rejoindre l&rsquo;équipe !
                </p>
              </div>
              <Link
                href="/books/new"
                className="rounded-full bg-peche px-6 py-2.5 text-sm font-bold text-aubergine shadow-lg transition-colors hover:bg-white"
              >
                🚀 Lancer un livre
              </Link>
            </div>
            <div className="mt-8">
              <BookFiltersBar
                action="/books"
                filters={filters}
                themes={options.themes}
                levels={options.levels}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <p className="text-sm text-graphite">
            {books.length} histoire{books.length > 1 ? "s" : ""}{" "}
            en cours d&rsquo;écriture
          </p>
          {books.length === 0 ? (
            <p className="mt-6 text-graphite">
              Aucun livre ne correspond à ta recherche.{" "}
              <Link href="/books" className="font-bold text-brand hover:underline">
                Voir tous les livres
              </Link>{" "}
              ou{" "}
              <Link href="/books/new" className="font-bold text-brand hover:underline">
                lance le tien
              </Link>
              &nbsp;!
            </p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
