import Image from "next/image";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/books");
  const { mode } = await searchParams;

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-aubergine px-4 py-12">
      <Image
        src="/images/logo-co-aut.png"
        alt="Logo Co-Aut"
        width={200}
        height={75}
        priority
      />
      <h1 className="mt-6 text-center font-display text-2xl font-bold text-white md:text-3xl">
        La plateforme d&rsquo;écriture{" "}
        <span className="text-brand">collaborative</span>
      </h1>
      <p className="mt-3 max-w-md text-center text-white/80">
        Écris des livres en équipe, chacun son tour, et laisse parler ton
        imagination.
      </p>

      <div className="mt-10 flex w-full justify-center">
        <AuthForm initialMode={mode} />
      </div>

      <p className="mt-8 text-center text-sm text-white/60">
        En savoir plus sur Co-Aut ?{" "}
        <a
          href="https://www.co-aut.com"
          className="font-semibold text-peche hover:underline"
        >
          Découvre le site
        </a>
      </p>
    </main>
  );
}
