import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard, { BookShelf } from "@/components/BookCard";
import BookFiltersBar from "@/components/BookFilters";
import { LINK, PageHeading } from "@/components/ui";
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
  const ids = books.map((b) => b.id);
  const favCounts = await getFavoriteCounts(ids);
  // Les plus populaires d'abord (à égalité : ordre historique).
  const sorted = books
    .slice()
    .sort((a, b) => (favCounts.get(b.id) ?? 0) - (favCounts.get(a.id) ?? 0));
  const n = books.length;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-9 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          title={`${n} livre${n > 1 ? "s" : ""} publié${n > 1 ? "s" : ""}`}
          intro="Tous les livres terminés, écrits en équipe par les co-auteurs. Les plus aimés d'abord."
        />

        <BookFiltersBar
          action="/bibliotheque"
          filters={filters}
          themes={options.themes}
          levels={options.levels}
        />

        {n === 0 ? (
          <p className="text-[17px] text-muted">
            Aucun livre ne correspond à ta recherche.{" "}
            <Link href="/bibliotheque" className={LINK}>
              Voir toute la bibliothèque
            </Link>
          </p>
        ) : (
          <BookShelf>
            {sorted.map((b) => (
              <BookCard
                key={b.id}
                book={b}
                favCount={favCounts.get(b.id) ?? 0}
              />
            ))}
          </BookShelf>
        )}
      </main>
      <Footer />
    </>
  );
}
