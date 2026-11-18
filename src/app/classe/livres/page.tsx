import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard, { BookShelf } from "@/components/BookCard";
import { Notice, PageHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { BOOK_SUMMARY, getCoverPaths, getCurrentWriters, type BookSummary } from "@/lib/books";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ma classe | Co-Aut" };

/** Accueil de l'élève : uniquement les livres de sa classe (la RLS ne lui en montre pas d'autres). */
export default async function ClasseLivresPage() {
  const user = await getCurrentUser();
  if (!user?.isStudent || !user.authorId) redirect("/classe");

  const supabase = await createClient();
  const { data: me } = await supabase
    .from("class_students")
    .select("first_name, class_id, active, classes(name)")
    .eq("author_id", user.authorId)
    .maybeSingle();
  const className = (me?.classes as unknown as { name: string } | null)?.name;

  const { data } = me?.active
    ? await supabase
        .from("books")
        .select(BOOK_SUMMARY)
        .eq("class_id", me.class_id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const books = (data ?? []) as unknown as BookSummary[];
  const open = books.filter((b) => b.status === "launched");
  const done = books.filter((b) => b.status === "published");
  const [writers, covers] = await Promise.all([
    getCurrentWriters(open),
    getCoverPaths(books.map((b) => b.id)),
  ]);
  const mine = open.filter((b) => writers.get(b.id) === user.authorId);

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          eyebrow={className}
          title={`Bonjour ${me?.first_name ?? user.nickname}`}
          intro={
            mine.length > 0
              ? "C'est à toi d'écrire ! Ouvre le livre et écris la suite de l'histoire."
              : open.length > 0
                ? "Ce n'est pas encore ton tour. Tu peux lire l'histoire en attendant."
                : "Ta classe n'a pas de livre en cours pour le moment."
          }
        />
        {!me?.active && (
          <Notice error="Ce code ne marche plus. Demande un nouveau code à ton enseignant." />
        )}

        {open.length > 0 && (
          <BookShelf>
            {[...mine, ...open.filter((b) => !mine.includes(b))].map((b) => (
              <BookCard
                key={b.id}
                book={b}
                coverPath={covers.get(b.id)}
                flags={{ myTurn: writers.get(b.id) === user.authorId }}
              />
            ))}
          </BookShelf>
        )}

        {done.length > 0 && (
          <>
            <h2 className="border-t border-line pt-8 font-display text-[28px] font-bold leading-tight tracking-tight">
              Livres terminés
            </h2>
            <BookShelf>
              {done.map((b) => (
                <BookCard key={b.id} book={b} coverPath={covers.get(b.id)} flags={{}} />
              ))}
            </BookShelf>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
