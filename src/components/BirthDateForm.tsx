"use client";

import { useActionState } from "react";
import { updateBirthDate } from "@/app/profil/actions";

export default function BirthDateForm({
  birthDate,
  maxDate,
}: {
  birthDate: string | null;
  maxDate: string;
}) {
  const [state, action, pending] = useActionState(updateBirthDate, {});
  return (
    <form action={action} className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="birth_date"
          type="date"
          required
          defaultValue={birthDate ?? ""}
          max={maxDate}
          aria-label="Date de naissance"
          className="rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-6 py-3 font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      {state.error && (
        <p className="rounded-xl bg-brand-dark/10 px-4 py-3 text-sm font-semibold text-brand-dark">
          {state.error}
        </p>
      )}
      {state.info && (
        <p className="rounded-xl bg-peche/30 px-4 py-3 text-sm font-semibold text-aubergine">
          {state.info}
        </p>
      )}
    </form>
  );
}
