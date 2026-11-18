import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewBookForm, { type ClassOption } from "@/app/books/new/NewBookForm";
import { LINK, PageHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedClasses } from "@/lib/classes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lancer un livre | Co-Aut",
};

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string }>;
}) {
  const [user, { classe }] = await Promise.all([getCurrentUser(), searchParams]);

  // Professionnel : choix Public / Réservé à ma classe.
  let classes: ClassOption[] = [];
  if (user?.isProfessional && user.authorId) {
    const owned = await listOwnedClasses(user.authorId);
    if (owned.length) {
      const supabase = await createClient();
      const { data: students } = await supabase
        .from("class_students")
        .select("class_id")
        .in("class_id", owned.map((c) => c.id))
        .eq("active", true);
      classes = owned.map((c) => ({
        id: c.id,
        name: c.name,
        students: (students ?? []).filter((s) => s.class_id === c.id).length,
      }));
    }
  }

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-20 pt-10 sm:px-6">
        <Link href="/books" className={`${LINK} inline-flex min-h-11 items-center self-start text-[15px]`}>
          ← Retour aux livres à rejoindre
        </Link>
        <PageHeading
          title="Lancer un livre"
          intro="Trouve un titre, écris le résumé et choisis la taille de ton équipe. Les co-auteurs écriront chacun leur tour, jusqu'au mot fin."
        />
        <NewBookForm classes={classes} defaultClassId={classe} />
      </main>
      <Footer />
    </>
  );
}
