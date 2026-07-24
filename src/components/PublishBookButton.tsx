"use client";

import { useActionState } from "react";
import { publishBook, type ActionState } from "@/app/books/actions";

export default function PublishBookButton({ bookRef }: { bookRef: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    publishBook,
    {}
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="book_ref" value={bookRef} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Publier le livre ? L'écriture sera définitivement terminée.")) {
            e.preventDefault();
          }
        }}
        className="rounded-full border-2 border-peche px-6 py-2.5 text-sm font-bold text-peche transition-colors hover:bg-peche hover:text-aubergine disabled:opacity-60"
      >
        {pending ? "Publication…" : "📖 Publier le livre"}
      </button>
      {state.error && (
        <p className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-peche">
          {state.error}
        </p>
      )}
    </form>
  );
}
