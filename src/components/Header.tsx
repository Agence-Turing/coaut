"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Cta } from "@/components/Buttons";
import { signOut } from "@/app/auth/actions";

type HeaderUser = { nickname: string } | null;

function navLinks(user: HeaderUser) {
  return [
    { href: "/books", label: "Rejoindre un livre" },
    { href: "/bibliotheque", label: "La bibliothèque" },
    ...(user ? [{ href: "/books/mes-livres", label: "Mes livres" }] : []),
  ];
}

function AuthZone({ user }: { user: HeaderUser }) {
  if (!user) {
    return (
      <>
        <Cta href="/?mode=signup">M&apos;inscrire</Cta>
        <Cta href="/?mode=login" variant="outline">
          Me connecter
        </Cta>
      </>
    );
  }
  return (
    <>
      <span className="text-sm font-semibold text-peche">✍️ {user.nickname}</span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border-2 border-white px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-white hover:text-aubergine"
        >
          Se déconnecter
        </button>
      </form>
    </>
  );
}

export default function Header({ user = null }: { user?: HeaderUser }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-aubergine shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href={user ? "/books" : "/"} className="shrink-0">
          <Image
            src="/images/logo-co-aut.png"
            alt="Logo Co-Aut"
            width={140}
            height={53}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks(user).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-white/90 transition-colors hover:text-peche"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <AuthZone user={user} />
        </div>

        <button
          type="button"
          aria-label="Permuter le menu"
          className="text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 px-4 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks(user).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-semibold text-white/90"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <AuthZone user={user} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
