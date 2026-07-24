import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewBookForm from "@/app/books/new/NewBookForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Lancer un livre | Co-Aut",
};

export default async function NewBookPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
            <Link href="/books" className="text-sm text-white/70 hover:text-peche">
              ← Retour à la bibliothèque
            </Link>
            <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">
              Lancer <span className="text-brand">un livre</span>
            </h1>
            <p className="mt-3 text-white/85">
              Tu as une idée d&rsquo;histoire ? Choisis un thème, trouve un
              titre, écris ton synopsis et construis ton équipe. Les co-auteurs
              écriront chacun leur tour, jusqu&rsquo;au mot fin.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <NewBookForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
