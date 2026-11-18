"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type ComponentProps } from "react";

/** Onglets de l'administration (enabled: false masque un onglet sans retirer sa page). */
const TABS = [
  { href: "/admin/livres", label: "Livres", enabled: true },
  { href: "/admin/auteurs", label: "Auteurs", enabled: true },
  { href: "/admin/tours", label: "Tours", enabled: true },
  { href: "/admin/classes", label: "Classes", enabled: true },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration" className="flex gap-1 overflow-x-auto border-b border-line">
      {TABS.filter((t) => t.enabled).map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center whitespace-nowrap border-b-[3px] px-3 text-base font-medium ${
              active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Filtres d'un tableau : appliqués dès qu'une liste change, et après une courte pause de frappe
 * dans les champs texte. Sans JavaScript, le formulaire reste un GET classique.
 */
export function FilterForm({
  action,
  children,
}: {
  action: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const v = String(value).trim();
      if (v) params.set(key, v);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      ref={formRef}
      method="get"
      action={action}
      role="search"
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={(e) => {
        const target = e.target as unknown as HTMLInputElement;
        if (target.type === "search" || target.type === "text") {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(apply, 400);
        } else {
          apply();
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {children}
    </form>
  );
}

/** Bouton d'envoi qui demande confirmation avant une action irréversible. */
export function ConfirmButton({
  message,
  ...props
}: ComponentProps<"button"> & { message: string }) {
  return (
    <button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}

/** Bouton du lot : confirmation seulement si l'action choisie est une suppression. */
export function BulkSubmit({
  className,
  label = "Appliquer",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="submit"
      name="do"
      value="bulk"
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const data = new FormData(form);
        const checked = data.getAll("ids").length;
        if (checked === 0) return; // le serveur répond « Coche au moins une ligne ».
        if (
          data.get("bulk") === "supprime" &&
          !window.confirm(`Supprimer définitivement ${checked} ligne${checked > 1 ? "s" : ""} ?`)
        ) {
          e.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}

/** Case « tout cocher » de l'en-tête d'un tableau. */
export function SelectAll() {
  return (
    <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="h-5 w-5 accent-ink"
        onChange={(e) => {
          const form = e.currentTarget.form;
          form
            ?.querySelectorAll<HTMLInputElement>('input[name="ids"]')
            .forEach((box) => (box.checked = e.currentTarget.checked));
        }}
      />
      <span className="sr-only">Tout sélectionner</span>
    </label>
  );
}
