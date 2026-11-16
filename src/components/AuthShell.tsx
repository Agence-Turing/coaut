import Link from "next/link";
import Logo from "@/components/Logo";

/** Cadre commun des pages d'accès au compte : logo, carte centrée. */
export default function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <Link href="/" aria-label="Co-Aut, accueil">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-14">
        <div className="w-full max-w-md rounded-2xl border border-line p-6 sm:p-8">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {intro && <p className="mt-3 text-[15px] leading-relaxed text-muted">{intro}</p>}
          {children}
        </div>
      </main>
    </>
  );
}
