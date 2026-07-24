import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard from "@/components/BookCard";
import { listBooks } from "@/lib/books";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "La bibliothèque | Co-Aut",
  description:
    "Découvre les livres en cours d'écriture à rejoindre et les livres déjà écrits par la communauté Co-Aut.",
};

const TABS = [
  { key: "a-rejoindre", label: "Livres à rejoindre", status: "launched" as const },
  { key: "publies", label: "Livres publiés", status: "published" as const },
];

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const { statut } = await searchParams;
  const tab = TABS.find((t) => t.key === statut) ?? TABS[0];
  const [books, author] = await Promise.all([
    listBooks(tab.status),
    getCurrentUser(),
  ]);

  return (
    <>
      <Header user={author} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              La <span className="text-brand">bibliothèque</span>
            </h1>
            <p className="mt-3 max-w-2xl text-white/85">
              Rejoins un livre en cours d&rsquo;écriture ou voyage dans
              l&rsquo;imaginaire de la communauté avec les livres déjà écrits en
              équipe.
            </p>
            <div className="mt-8 flex gap-3">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={`/books?statut=${t.key}`}
                  className={`rounded-full px-6 py-2.5 text-sm font-bold transition-colors ${
                    t.key === tab.key
                      ? "bg-brand text-white"
                      : "border-2 border-white/40 text-white hover:border-white"
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <p className="text-sm text-graphite">
            {books.length} livre{books.length > 1 ? "s" : ""}{" "}
            {tab.status === "launched" ? "en cours d'écriture" : "publiés"}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
