import Image from "next/image";
import Link from "next/link";

/** Cadre commun des pages d'accès au compte (fond aubergine, logo, carte blanche). */
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
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-aubergine px-4 py-12">
      <Link href="/">
        <Image
          src="/images/logo-co-aut.png"
          alt="Logo Co-Aut"
          width={200}
          height={75}
          priority
        />
      </Link>
      <div className="mt-10 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="font-display text-2xl font-bold text-aubergine">
          {title}
        </h1>
        {intro && <p className="mt-3 text-sm text-ink/70">{intro}</p>}
        {children}
      </div>
    </main>
  );
}
