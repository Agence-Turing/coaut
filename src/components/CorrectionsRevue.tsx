"use client";

import { useState } from "react";
import { appliquer, type Correction } from "@/lib/correction/filtre";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui";

/**
 * Relecture des fautes avant l'envoi d'un tour : le texte de l'auteur avec les
 * mots corrigés surlignés (ancien barré, nouveau en gras). Toucher un mot
 * rend sa version à l'auteur ; « Envoyer » part avec les corrections gardées.
 */
export default function CorrectionsRevue({
  texte,
  corrections,
  jeton,
  bookRef,
  action,
  pending,
  onTexte,
  onRetour,
}: {
  texte: string;
  corrections: Correction[];
  /** Jeton signé par le serveur : évite de refaire la modération à l'envoi. */
  jeton: string | null;
  bookRef: string;
  action: (formData: FormData) => void;
  pending: boolean;
  /** Texte envoyé, gardé dans l'éditeur si l'envoi échoue. */
  onTexte: (texte: string) => void;
  onRetour: (texte: string) => void;
}) {
  const [gardees, setGardees] = useState<Set<number>>(new Set());
  const final = appliquer(texte, corrections, gardees);
  const acceptees = corrections.length - gardees.size;

  function basculer(i: number) {
    setGardees((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(i)) suivant.delete(i);
      else suivant.add(i);
      return suivant;
    });
  }

  const morceaux: React.ReactNode[] = [];
  let curseur = 0;
  corrections.forEach((c, i) => {
    morceaux.push(texte.slice(curseur, c.debut));
    const garde = gardees.has(i);
    morceaux.push(
      <button
        key={i}
        type="button"
        onClick={() => basculer(i)}
        aria-pressed={!garde}
        aria-label={
          garde
            ? `Ta version gardée : ${c.avant}. Touche pour corriger en ${c.apres}.`
            : `${c.avant} corrigé en ${c.apres}. Touche pour garder ta version.`
        }
        className={`mx-0.5 inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 align-middle transition-colors ${
          garde
            ? "border-2 border-dashed border-line-strong bg-paper text-ink hover:border-ink"
            : "border-2 border-transparent bg-tint-orange text-ink hover:border-ink"
        }`}
      >
        {garde ? (
          <span>{c.avant}</span>
        ) : (
          <>
            <s className="text-base text-muted decoration-1">{c.avant}</s>
            <span className="font-bold">{c.apres}</span>
          </>
        )}
      </button>
    );
    curseur = c.fin;
  });
  morceaux.push(texte.slice(curseur));

  return (
    <form action={action} onSubmit={() => onTexte(final)} className="flex flex-col gap-4">
      <input type="hidden" name="book_ref" value={bookRef} />
      <input type="hidden" name="content" value={final} />
      <input type="hidden" name="jeton" value={jeton ?? ""} />
      <input type="hidden" name="finish" value="1" />
      <input type="hidden" name="revu" value="1" />

      <h3 className="font-display text-2xl font-bold leading-tight">
        Avant d&rsquo;envoyer, quelques fautes
      </h3>
      <p className="text-[15px] leading-relaxed text-muted">
        Les mots surlignés sont corrigés. Si tu préfères ta version, touche le
        mot. Le reste de ton texte ne change pas.
      </p>

      <div className="whitespace-pre-wrap rounded-xl border-2 border-ink bg-paper p-4 font-display text-xl leading-[2.6rem] text-ink">
        {morceaux}
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {acceptees} correction{acceptees > 1 ? "s" : ""} sur {corrections.length}
        {gardees.size > 0 &&
          ` · ${gardees.size} mot${gardees.size > 1 ? "s" : ""} gardé${gardees.size > 1 ? "s" : ""} comme tu l'as écrit`}
      </p>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => onRetour(final)}
          disabled={pending}
          className={`${BTN_SECONDARY} min-h-12`}
        >
          Revenir à mon texte
        </button>
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12`}>
          {pending ? "…" : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
