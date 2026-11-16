import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewBookForm from "@/app/books/new/NewBookForm";
import { LINK, PageHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Lancer un livre | Co-Aut",
};

export default async function NewBookPage() {
  const user = await getCurrentUser();

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
        <NewBookForm />
      </main>
      <Footer />
    </>
  );
}
