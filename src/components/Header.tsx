"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Cta } from "@/components/Buttons";

const NAV_LINKS = [
  { href: "/comment-ca-marche", label: "Comment ça marche ?" },
  { href: "/books", label: "La bibliothèque" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-aubergine shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="shrink-0">
          <Image
            src="/images/logo-co-aut.png"
            alt="Logo Co-Aut"
            width={140}
            height={53}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
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
          <Cta href="/signup">M&apos;inscrire</Cta>
          <Cta href="/login" variant="outline">
            Me connecter
          </Cta>
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
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-semibold text-white/90"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-2">
              <Cta href="/signup">M&apos;inscrire</Cta>
              <Cta href="/login" variant="outline">
                Me connecter
              </Cta>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
