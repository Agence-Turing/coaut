"use client";

import { useActionState } from "react";
import { requestJoin, type ActionState } from "@/app/books/actions";
import { BTN_PRIMARY, INPUT, Notice } from "@/components/ui";

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

  if (state.info) return <Notice info={state.info} />;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="book_ref" value={bookRef} />
      <label htmlFor="message" className="font-display text-2xl font-bold leading-tight">
        Envie d&rsquo;écrire la suite ?
      </label>
      <p className="text-[15px] leading-relaxed text-muted">
        Présente-toi au lanceur du livre : dis-lui pourquoi tu veux écrire
        cette histoire avec lui.
      </p>
      <textarea
        id="message"
        name="message"
        required
        minLength={10}
        rows={3}
        className={INPUT}
      />
      <Notice error={state.error} />
      <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12 self-start`}>
        {pending ? "Envoi…" : "Demander à rejoindre"}
      </button>
    </form>
  );
}
