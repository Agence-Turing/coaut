import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CreateClassForm } from "@/components/classes/ClassForms";
import { LINK, PageHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedClasses } from "@/lib/classes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mes classes | Co-Aut" };

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");

  if (!user.isProfessional || !user.authorId) {
    return (
      <>
        <Header user={user} />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-20 pt-12 sm:px-6">
          <PageHeading
            title="Mes classes"
            intro="Les classes sont réservées aux enseignants et aux professionnels qui écrivent avec des enfants."
          />
          <p className="text-[17px] text-muted">
            Coche la case « enseignant ou professionnel » dans{" "}
            <Link href="/profil" className={LINK}>
              ton profil
            </Link>
            , puis reviens ici.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  const classes = await listOwnedClasses(user.authorId);
  const ids = classes.map((c) => c.id);
  const supabase = await createClient();
  const [{ data: students }, { data: books }] = ids.length
    ? await Promise.all([
        supabase.from("class_students").select("class_id").in("class_id", ids).eq("active", true),
        supabase.from("books").select("class_id, status").in("class_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          title="Mes classes"
          intro="Une classe, c'est un groupe d'élèves qui écrit ensemble. Chaque élève a son code personnel, sans e-mail ni mot de passe."
        />

        {classes.length > 0 && (
          <ul className="flex flex-col rounded-2xl border border-line">
            {classes.map((c) => {
              const n = (students ?? []).filter((s) => s.class_id === c.id).length;
              const own = (books ?? []).filter((b) => b.class_id === c.id);
              const open = own.filter((b) => b.status === "launched").length;
              const done = own.filter((b) => b.status === "published").length;
              const facts = [
                plural(n, "élève", "élèves"),
                open ? plural(open, "livre en cours", "livres en cours") : null,
                done ? plural(done, "livre publié", "livres publiés") : null,
                !open && !done ? "pas encore de livre" : null,
              ].filter(Boolean);
              return (
                <li key={c.id} className="border-b border-line last:border-0">
                  <Link
                    href={`/classes/${c.id}`}
                    className="flex min-h-16 flex-col justify-center gap-1 px-5 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="break-words font-display text-xl font-bold text-ink">
                      {c.name}
                    </span>
                    <span className="text-[15px] text-muted">{facts.join(" · ")}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <section className="rounded-2xl border border-line p-5 sm:p-6">
          <h2 className="mb-5 font-display text-2xl font-bold leading-tight">
            {classes.length ? "Créer une autre classe" : "Créer ma première classe"}
          </h2>
          <CreateClassForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
