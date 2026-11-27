"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { Cta, BTN_SECONDARY } from "@/components/ui";
import { signOut } from "@/app/auth/actions";
import { leaveClass } from "@/app/classe/actions";
import { setReportedUser } from "@/lib/error-reporting";

type HeaderUser = {
  nickname: string;
  /** Id de la fiche auteur : seul identifiant joint aux erreurs envoyées à GlitchTip. */
  authorId?: string | null;
  needsBirthDate?: boolean;
  isStudent?: boolean;
  isProfessional?: boolean;
  isAdmin?: boolean;
} | null;

function navLinks(user: HeaderUser) {
  // Élève : sa classe, rien d'autre.
  if (user?.isStudent) return [{ href: "/classe/livres", label: "Les livres de ma classe" }];
  return [
    { href: "/books", label: "Rejoindre un livre" },
    { href: "/bibliotheque", label: "Bibliothèque" },
    ...(user ? [{ href: "/books/mes-livres", label: "Mes livres" }] : []),
    ...(user?.isProfessional ? [{ href: "/classes", label: "Mes classes" }] : []),
    ...(user?.isAdmin ? [{ href: "/admin", label: "Administration" }] : []),
  ];
}

/**
 * Lien de navigation actif. `/books` (« Rejoindre un livre ») ne vaut que pour
 * la liste elle-même : la page d'un livre (/books/[code]) passe son onglet
 * d'origine via `activeHref`.
 */
function isActive(pathname: string, href: string, active?: string | null) {
  if (active !== undefined) return active === href;
  if (href === "/books") return pathname === "/books";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProfileLink({ user }: { user: NonNullable<HeaderUser> }) {
  if (user.isStudent) {
    return (
      <span className="inline-flex min-h-11 items-center text-[15px] font-semibold text-ink">
        {user.nickname}
      </span>
    );
  }
  return (
    <Link
      href="/profil"
      className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-ink hover:text-link"
    >
      {user.nickname}
      {user.needsBirthDate && (
        <span className="rounded-full bg-tint-orange px-2.5 py-1 text-xs font-semibold text-ink">
          Profil à compléter
        </span>
      )}
    </Link>
  );
}

function SignOut({ student = false }: { student?: boolean }) {
  return (
    <form action={student ? leaveClass : signOut} onSubmit={() => setReportedUser(null)}>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center text-[15px] font-medium text-muted hover:text-ink"
      >
        Se déconnecter
      </button>
    </form>
  );
}

export default function Header({
  user = null,
  activeHref,
}: {
  user?: HeaderUser;
  /** Onglet à souligner, quand l'adresse ne suffit pas à le savoir (page d'un livre). */
  activeHref?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = navLinks(user);

  // Erreurs envoyées à GlitchTip : id de la fiche et rôle seulement (auteurs mineurs).
  const authorId = user?.authorId ?? null;
  const role = user?.isAdmin ? "admin" : user?.isStudent ? "student" : "adult";
  useEffect(() => {
    setReportedUser(authorId ? { id: authorId, role } : null);
  }, [authorId, role]);

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href={user?.isStudent ? "/classe/livres" : user ? "/books" : "/"}
          aria-label="Co-Aut, accueil"
          className="shrink-0"
        >
          <Logo />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => {
            const active = isActive(pathname, l.href, activeHref);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`border-b-[3px] py-2.5 text-base font-medium transition-colors ${
                  active
                    ? "border-brand text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {user ? (
            <>
              {!user.isStudent && <Cta href="/books/new">Lancer un livre</Cta>}
              <ProfileLink user={user} />
              <SignOut student={user.isStudent} />
            </>
          ) : (
            <>
              <Cta href="/?mode=login" variant="secondary">
                Me connecter
              </Cta>
              <Cta href="/?mode=signup">M&apos;inscrire</Cta>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="menu-mobile"
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-line-strong text-ink lg:hidden"
          onClick={() => setOpen((o) => !o)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="menu-mobile"
          aria-label="Navigation principale"
          className="border-t border-line px-4 pb-5 pt-2 lg:hidden"
        >
          <ul className="flex flex-col">
            {links.map((l) => {
              const active = isActive(pathname, l.href, activeHref);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center border-l-[3px] pl-3 text-base font-medium ${
                      active ? "border-brand text-ink" : "border-transparent text-muted"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-col gap-3 border-t border-line pt-4">
            {user ? (
              <>
                {!user.isStudent && (
                  <Cta href="/books/new" onClick={() => setOpen(false)}>
                    Lancer un livre
                  </Cta>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <ProfileLink user={user} />
                  <SignOut student={user.isStudent} />
                </div>
              </>
            ) : (
              <>
                <Cta href="/?mode=signup">M&apos;inscrire</Cta>
                <Link href="/?mode=login" className={BTN_SECONDARY}>
                  Me connecter
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
