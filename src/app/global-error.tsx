"use client";

import { useEffect } from "react";
import "./globals.css";
import { BTN_PRIMARY } from "@/components/ui";
import { reportError } from "@/lib/error-reporting";

/** Erreur dans la mise en page racine : remplace tout le document, l'erreur part à GlitchTip. */
export default function GlobalError({
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
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-4 text-center font-sans text-ink">
        <title>Erreur | Co-Aut</title>
        <h1 className="text-3xl font-bold leading-tight">Quelque chose s&rsquo;est mal passé.</h1>
        <p className="max-w-md text-[17px] leading-relaxed text-muted">
          L&rsquo;erreur nous a été signalée. Tu peux réessayer dans un instant.
        </p>
        <button type="button" className={BTN_PRIMARY} onClick={() => unstable_retry()}>
          Réessayer
        </button>
      </body>
    </html>
  );
}
