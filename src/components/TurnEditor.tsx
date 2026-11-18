"use client";

import { useActionState, useState } from "react";
import { saveTurn, type ActionState } from "@/app/books/actions";
import { BTN_PRIMARY, BTN_SECONDARY, Notice } from "@/components/ui";
import CorrectionsRevue from "@/components/CorrectionsRevue";

/** Coups de pouce : une phrase d'aide, sans IA ni appel réseau. */
const TIPS = [
  {
    label: "Fais parler un personnage",
    help: "Ouvre un tiret et laisse quelqu'un dire ce qu'il pense, ce qu'il veut ou ce qu'il cache. Deux répliques suffisent à relancer la scène.",
  },
  {
    label: "Décris le lieu",
    help: "Où sommes-nous ? Donne un bruit, une odeur, une lumière : trois détails et le lecteur y est.",
  },
  {
    label: "Ajoute un imprévu",
    help: "Quelqu'un arrive, un objet disparaît, un secret éclate. Pose un problème que le co-auteur suivant devra résoudre.",
  },
] as const;

export default function TurnEditor({
  bookRef,
  draft,
  nickname,
}: {
  bookRef: string;
  draft: string;
  nickname: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveTurn,
    {}
  );
  const [tip, setTip] = useState<number | null>(null);
  // Champ contrôlé : React vide les formulaires après une action ; un texte refusé par la
  // modération doit rester dans l'éditeur pour être corrigé.
  const [text, setText] = useState(draft);
  const length = text.length;
  // Fautes trouvées à l'envoi : relecture tant que l'auteur ne revient pas à son texte.
  const [revueFermee, setRevueFermee] = useState<ActionState | null>(null);
  const revue = state.revue && revueFermee !== state ? state.revue : null;

  if (revue)
    return (
      <CorrectionsRevue
        key={revue.jeton ?? revue.texte}
        texte={revue.texte}
        corrections={revue.corrections}
        jeton={revue.jeton}
        bookRef={bookRef}
        action={action}
        pending={pending}
        onTexte={setText}
        onRetour={(final) => {
          setText(final);
          setRevueFermee(state);
        }}
      />
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="book_ref" value={bookRef} />
      <label
        htmlFor="turn-content"
        className="font-display text-2xl font-bold leading-tight"
      >
        {nickname}, c&rsquo;est ton tour
      </label>
      <p className="text-[15px] leading-relaxed text-muted">
        Écris la suite de l&rsquo;histoire. Tu peux enregistrer ton brouillon
        et revenir plus tard ; quand tu termines ton tour, la plume passe au
        co-auteur suivant.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Un coup de pouce ?</span>
          {TIPS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              aria-expanded={tip === i}
              aria-controls="turn-tip"
              onClick={() => setTip(tip === i ? null : i)}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${
                tip === i
                  ? "border-ink bg-tint-orange text-ink"
                  : "border-line-strong bg-paper text-ink hover:border-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p
          id="turn-tip"
          aria-live="polite"
          className={
            tip === null
              ? "hidden"
              : "rounded-[10px] bg-tint-cream px-3.5 py-3 text-[15px] leading-relaxed text-ink"
          }
        >
          {tip !== null && TIPS[tip].help}
        </p>
      </div>

      <textarea
        id="turn-content"
        name="content"
        rows={8}
        value={text}
        placeholder="Que se passe-t-il ensuite ?"
        onChange={(e) => setText(e.target.value)}
        className="block w-full resize-y rounded-xl border-2 border-ink bg-paper p-4 font-display text-xl leading-relaxed text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ink/20"
      />

      <Notice error={state.error} info={state.info} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {length} caractère{length > 1 ? "s" : ""}
        </span>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="finish"
            value="0"
            disabled={pending}
            className={`${BTN_SECONDARY} min-h-12`}
          >
            {pending ? "…" : "Enregistrer le brouillon"}
          </button>
          <button
            type="submit"
            name="finish"
            value="1"
            disabled={pending}
            className={`${BTN_PRIMARY} min-h-12`}
          >
            {pending ? "…" : "Terminer mon tour"}
          </button>
        </div>
      </div>
    </form>
  );
}
