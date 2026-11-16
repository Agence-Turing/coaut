"use client";

import { useActionState } from "react";
import { updateBirthDate } from "@/app/profil/actions";
import { BTN_PRIMARY, INPUT, Notice } from "@/components/ui";

export default function BirthDateForm({
  birthDate,
  maxDate,
}: {
  birthDate: string | null;
  maxDate: string;
}) {
  const [state, action, pending] = useActionState(updateBirthDate, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="birth_date"
          type="date"
          required
          defaultValue={birthDate ?? ""}
          max={maxDate}
          aria-label="Date de naissance"
          className={`${INPUT} w-auto`}
        />
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12`}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <Notice error={state.error} info={state.info} />
    </form>
  );
}
