import Link from "next/link";
import Logo from "@/components/Logo";
import { Cta, EYEBROW } from "@/components/ui";

export const metadata = { title: "Page introuvable | Co-Aut" };

export default function NotFound() {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Co-Aut, accueil">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <p className={EYEBROW}>Erreur 404</p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Cette page n&rsquo;existe pas.
        </h1>
        <p className="max-w-md text-[17px] leading-relaxed text-muted">
          Le livre a peut-être été retiré, ou l&rsquo;adresse contient une
          erreur.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Cta href="/books">Voir les livres à rejoindre</Cta>
          <Cta href="/bibliotheque" variant="secondary">
            Ouvrir la bibliothèque
          </Cta>
        </div>
      </main>
    </>
  );
}
