"use client";

import { useActionState } from "react";
import { publishBook, type ActionState } from "@/app/books/actions";
import { BTN_DARK, Notice } from "@/components/ui";

export default function PublishBookButton({ bookRef }: { bookRef: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    publishBook,
    {}
  );

  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="book_ref" value={bookRef} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("Publier le livre ? L'écriture sera définitivement terminée.")) {
            e.preventDefault();
          }
        }}
        className={BTN_DARK}
      >
        {pending ? "Publication…" : "Publier le livre"}
      </button>
      <Notice error={state.error} />
    </form>
  );
}
