"use client";

import { useActionState } from "react";
import { requestJoin, type ActionState } from "@/app/books/actions";

export default function JoinRequestForm({
  bookId,
  bookRef,
}: {
  bookId: string;
  bookRef: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestJoin,
    {}
  );

  if (state.info) {
    return (
      <p className="rounded-2xl bg-peche/20 p-5 text-sm font-semibold text-brand-dark">
        ✉️ {state.info}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="book_ref" value={bookRef} />
      <label htmlFor="message" className="block font-display font-bold text-white">
        Envie de rejoindre l&rsquo;écriture ?
      </label>
      <textarea
        id="message"
        name="message"
        required
        minLength={10}
        rows={3}
        placeholder="Présente-toi au lanceur du livre : pourquoi veux-tu écrire cette histoire avec lui ?"
        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
      />
      {state.error && (
        <p className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-peche">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Demander à rejoindre"}
      </button>
    </form>
  );
}
