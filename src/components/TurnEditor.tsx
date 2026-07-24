"use client";

import { useActionState } from "react";
import { saveTurn, type ActionState } from "@/app/books/actions";

export default function TurnEditor({
  bookRef,
  turnNumber,
  draft,
}: {
  bookRef: string;
  turnNumber: number;
  draft: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveTurn,
    {}
  );

  return (
    <form action={action} className="rounded-3xl border-2 border-brand bg-white p-6 shadow-xl">
      <input type="hidden" name="book_ref" value={bookRef} />
      <p className="font-display text-lg font-bold text-ink">
        ✍️ C&rsquo;est à toi d&rsquo;écrire — tour {turnNumber}
      </p>
      <p className="mt-1 text-sm text-graphite">
        Écris la suite de l&rsquo;histoire. Enregistre ton brouillon autant de
        fois que tu veux ; quand tu termines ton tour, la main passe au
        co-auteur suivant.
      </p>
      <textarea
        name="content"
        rows={8}
        defaultValue={draft}
        placeholder="Il était une fois…"
        className="mt-4 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 leading-relaxed text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
      />

      {state.error && (
        <p className="mt-3 rounded-xl bg-brand-dark/10 px-4 py-3 text-sm font-semibold text-brand-dark">
          {state.error}
        </p>
      )}
      {state.info && (
        <p className="mt-3 rounded-xl bg-peche/30 px-4 py-3 text-sm font-semibold text-aubergine">
          {state.info}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          name="finish"
          value="0"
          disabled={pending}
          className="rounded-full border-2 border-ink/20 px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {pending ? "…" : "Enregistrer le brouillon"}
        </button>
        <button
          type="submit"
          name="finish"
          value="1"
          disabled={pending}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "…" : "Terminer mon tour ✓"}
        </button>
      </div>
    </form>
  );
}
