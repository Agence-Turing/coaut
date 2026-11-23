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
  openToJoin,
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
  const [launched, options, user] = await Promise.all([
    listBooks("launched", filters),
    getFilterOptions("launched"),
    getCurrentUser(),
  ]);
  // Seulement les livres que l'on peut vraiment rejoindre : pas les siens
  // (lancés ou déjà dans l'équipe), pas ceux dont l'équipe est complète
  // (dont les livres « Commencé » de l'ancien site, voir openToJoin).
  const me = user?.authorId;
  const books = launched.filter(
    (b) =>
      (!me ||
        (b.launcher_id !== me && !b.book_players.some((p) => p.author_id === me))) &&
      openToJoin(b)
  );
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
              : `${n} histoire${n > 1 ? "s" : ""} à écrire`
          }
          intro="Choisis-en une et demande à rejoindre l'équipe. Dès que le lanceur accepte, vous écrivez chacun votre tour."
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
              <BookCard from="rejoindre" key={b.id} book={b} />
            ))}
          </BookShelf>
        )}
      </main>
      <Footer />
    </>
  );
}
