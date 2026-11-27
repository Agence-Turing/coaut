"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW } from "@/components/ui";
import { reportError } from "@/lib/error-reporting";

/** Page qui plante au rendu : un message au lieu de la page d'erreur de Next, et l'erreur part à GlitchTip. */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
      <p className={EYEBROW}>Erreur</p>
      <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Quelque chose s&rsquo;est mal passé.
      </h1>
      <p className="max-w-md text-[17px] leading-relaxed text-muted">
        L&rsquo;erreur nous a été signalée. Tu peux réessayer, ou revenir aux livres.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={BTN_PRIMARY} onClick={() => unstable_retry()}>
          Réessayer
        </button>
        <Link href="/books" className={BTN_SECONDARY}>
          Revenir aux livres
        </Link>
      </div>
    </main>
  );
}
