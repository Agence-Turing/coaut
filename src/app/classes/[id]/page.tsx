import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BookCard, { BookShelf } from "@/components/BookCard";
import { AddStudentsForm, ConfirmButton } from "@/components/classes/ClassForms";
import { Cta, EYEBROW, LINK, PageHeading } from "@/components/ui";
import { regenerateCode, removeStudent } from "@/app/classes/actions";
import { getCurrentUser } from "@/lib/auth";
import { BOOK_SUMMARY, getCoverPaths, type BookSummary } from "@/lib/books";
import { getOwnedClass, listStudents } from "@/lib/classes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ma classe | Co-Aut" };

const SMALL_BTN =
  "inline-flex min-h-11 items-center justify-center rounded-[10px] border border-line-strong bg-paper px-3.5 text-sm font-semibold text-ink hover:border-ink";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId || !user.isProfessional) redirect("/classes");
  const cls = await getOwnedClass(id, user.authorId);
  if (!cls) notFound();

  const students = await listStudents(cls.id);
  const supabase = await createClient();
  const [{ data: turns }, { data: booksData }] = await Promise.all([
    students.length
      ? supabase
          .from("turns")
          .select("author_id, content, is_ended")
          .in("author_id", students.map((s) => s.author_id))
      : Promise.resolve({ data: [] as { author_id: string; content: string | null; is_ended: boolean }[] }),
    supabase
      .from("books")
      .select(BOOK_SUMMARY)
      .eq("class_id", cls.id)
      .order("created_at", { ascending: false }),
  ]);
  const books = (booksData ?? []) as unknown as BookSummary[];
  const covers = await getCoverPaths(books.map((b) => b.id));
  const written = (authorId: string) =>
    (turns ?? []).filter((t) => t.author_id === authorId && t.is_ended && t.content).length;
  const open = books.some((b) => b.status === "launched");
  const codesWork = books.length === 0 || open;

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-20 pt-10 sm:px-6">
        <Link href="/classes" className={`${LINK} inline-flex min-h-11 items-center self-start text-[15px]`}>
          ← Mes classes
        </Link>
        <PageHeading
          title={cls.name}
          intro={
            codesWork
              ? "Chaque élève entre sur co-aut avec son code, à la page « Espace classe ». Il ne voit que les livres de cette classe."
              : "Tous les livres de cette classe sont terminés : les codes ne marchent plus. Lance un nouveau livre pour les réactiver."
          }
        >
          <div className="mt-2 flex flex-wrap gap-3">
            <Cta href={`/books/new?classe=${cls.id}`}>Lancer un livre pour cette classe</Cta>
            {students.length > 0 && (
              <Cta href={`/classes/${cls.id}/etiquettes`} variant="secondary">
                Imprimer les codes
              </Cta>
            )}
          </div>
        </PageHeading>

        <section aria-labelledby="eleves" className="flex flex-col gap-3">
          <h2 id="eleves" className="font-display text-2xl font-bold">
            {students.length} élève{students.length > 1 ? "s" : ""}
          </h2>
          {students.length === 0 ? (
            <p className="text-[17px] text-muted">Pas encore d&rsquo;élève dans cette classe.</p>
          ) : (
            <ul className="flex flex-col rounded-2xl border border-line">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="break-words text-[17px] font-semibold text-ink">{s.first_name}</span>
                    <span className="text-sm text-muted">
                      <span className="font-semibold tracking-[0.08em] text-ink">{s.code ?? "Sans code"}</span>
                      {" · "}
                      {written(s.author_id)} tour{written(s.author_id) > 1 ? "s" : ""} écrit
                      {written(s.author_id) > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={regenerateCode}>
                      <input type="hidden" name="student_id" value={s.id} />
                      <ConfirmButton
                        message={`Donner un nouveau code à ${s.first_name} ? L'ancien ne marchera plus.`}
                        className={SMALL_BTN}
                      >
                        Nouveau code
                      </ConfirmButton>
                    </form>
                    <form action={removeStudent}>
                      <input type="hidden" name="student_id" value={s.id} />
                      <ConfirmButton
                        message={`Retirer ${s.first_name} de la classe ? Son code ne marchera plus ; ses tours déjà écrits restent dans les livres.`}
                        className={SMALL_BTN}
                      >
                        Retirer
                      </ConfirmButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <details className="rounded-2xl border border-line p-5 sm:p-6">
            <summary className={`${LINK} inline-flex min-h-11 cursor-pointer items-center text-[15px]`}>
              Ajouter des élèves
            </summary>
            <div className="mt-4">
              <AddStudentsForm classId={cls.id} />
            </div>
          </details>
        </section>

        <section aria-labelledby="livres" className="flex flex-col gap-5 border-t border-line pt-8">
          <h2 id="livres" className="font-display text-2xl font-bold">
            Livres de la classe
          </h2>
          {books.length === 0 ? (
            <p className="text-[17px] text-muted">
              Aucun livre pour l&rsquo;instant. Les élèves peuvent déjà entrer avec leur code.
            </p>
          ) : (
            <BookShelf>
              {books.map((b) => (
                <BookCard key={b.id} book={b} coverPath={covers.get(b.id)} flags={{}} />
              ))}
            </BookShelf>
          )}
          <p className={EYEBROW}>Un livre publié rejoint la bibliothèque publique de Co-Aut.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
