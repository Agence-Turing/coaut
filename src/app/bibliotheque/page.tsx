import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard from "@/components/BookCard";
import BookFiltersBar from "@/components/BookFilters";
import {
  listBooks,
  getFilterOptions,
  getFavoriteCounts,
  type BookFilters,
} from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "La bibliothèque | Co-Aut",
  description:
    "Voyage dans l'imaginaire de la communauté : tous les livres écrits en équipe sur Co-Aut.",
};

export default async function BibliothequePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; theme?: string; niveau?: string }>;
}) {
  const filters: BookFilters = await searchParams;
  const [books, options, user] = await Promise.all([
    listBooks("published", filters),
    getFilterOptions("published"),
    getCurrentUser(),
  ]);
  const favCounts = await getFavoriteCounts(books.map((b) => b.id));
  // Les plus populaires d'abord (à égalité : ordre historique).
  const sorted = books
    .slice()
    .sort((a, b) => (favCounts.get(b.id) ?? 0) - (favCounts.get(a.id) ?? 0));

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              La <span className="text-brand">bibliothèque</span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Voyage dans l&rsquo;imaginaire de la communauté : tous les livres
              déjà écrits en équipe par les co-auteurs.
            </p>
            <div className="mt-8">
              <BookFiltersBar
                action="/bibliotheque"
                filters={filters}
                themes={options.themes}
                levels={options.levels}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <p className="text-sm text-graphite">
            {books.length} livre{books.length > 1 ? "s" : ""}{" "}
            publié{books.length > 1 ? "s" : ""}
          </p>
          {books.length === 0 ? (
            <p className="mt-6 text-graphite">
              Aucun livre ne correspond à ta recherche.{" "}
              <Link
                href="/bibliotheque"
                className="font-bold text-brand hover:underline"
              >
                Voir toute la bibliothèque
              </Link>
            </p>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((b) => (
                <BookCard key={b.id} book={b} favCount={favCounts.get(b.id) ?? 0} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
