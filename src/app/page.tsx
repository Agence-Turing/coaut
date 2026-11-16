import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import Logo from "@/components/Logo";
import { EYEBROW, LINK } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; erreur?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/books");
  const { mode, erreur } = await searchParams;

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Co-Aut, accueil">
            <Logo />
          </Link>
          <a
            href="https://www.co-aut.com"
            className={`${LINK} inline-flex min-h-11 items-center text-[15px]`}
          >
            Découvrir Co-Aut
          </a>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center gap-10 px-4 pb-16 pt-12 sm:pt-16">
        <div className="flex max-w-3xl flex-col gap-4 text-center">
          <p className={EYEBROW}>Écriture collaborative</p>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Écris un livre à plusieurs,{" "}
            <span className="box-decoration-clone rounded-md bg-tint-orange px-2">
              chacun son tour.
            </span>
          </h1>
          <p className="text-lg leading-relaxed text-muted">
            Un paragraphe, puis tu passes la plume. Personne ne sait où
            l&rsquo;histoire ira.
          </p>
        </div>

        <AuthForm
          initialMode={mode}
          initialError={
            erreur === "lien"
              ? "Ce lien de confirmation n'est plus valable. Connecte-toi : si ton adresse n'est pas encore confirmée, tu pourras recevoir un nouveau lien."
              : undefined
          }
        />
      </main>
    </>
  );
}
