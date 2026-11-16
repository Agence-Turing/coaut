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
  getCoverPaths,
  type BookFilters,
} from "@/lib/books";
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
  const covers = await getCoverPaths(books.map((b) => b.id));
  const filtered = Boolean(filters.q || filters.theme || filters.niveau);
  const n = books.length;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-9 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          title={
            filtered
              ? `${n} histoire${n > 1 ? "s" : ""} trouvée${n > 1 ? "s" : ""}`
              : `${n} histoire${n > 1 ? "s" : ""} en cours d'écriture`
          }
          intro="Choisis-en une et demande à rejoindre l'équipe. Dès que le lanceur accepte, tu écris à ton tour."
        />

        <BookFiltersBar
          action="/books"
          filters={filters}
          themes={options.themes}
          levels={options.levels}
        />

        {n === 0 ? (
          <p className="text-[17px] text-muted">
            Aucun livre ne correspond à ta recherche.{" "}
            <Link href="/books" className={LINK}>
              Voir tous les livres
            </Link>{" "}
            ou{" "}
            <Link href="/books/new" className={LINK}>
              lance le tien
            </Link>
            .
          </p>
        ) : (
          <BookShelf>
            {books.map((b) => (
              <BookCard key={b.id} book={b} coverPath={covers.get(b.id)} />
            ))}
          </BookShelf>
        )}
      </main>
      <Footer />
    </>
  );
}
