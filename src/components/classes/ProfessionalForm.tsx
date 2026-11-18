"use client";

import { useActionState, useState } from "react";
import { updateProfessional } from "@/app/profil/actions";
import { BTN_PRIMARY, INPUT, LABEL, Notice } from "@/components/ui";

/** Case « professionnel » du profil : ouvre « Mes classes », sans validation. */
export default function ProfessionalForm({
  isProfessional,
  organization,
}: {
  isProfessional: boolean;
  organization: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfessional, {});
  const [checked, setChecked] = useState(isProfessional);
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <label className="flex min-h-11 items-start gap-3 text-[15px] text-ink">
        <input
          type="checkbox"
          name="is_professional"
          value="1"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-ink"
        />
        <span>Je suis enseignant ou professionnel et j&rsquo;écris avec des enfants</span>
      </label>
      {checked && (
        <div>
          <label htmlFor="organization" className={`${LABEL} mb-1.5`}>
            Établissement ou structure
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            required
            maxLength={120}
            defaultValue={organization ?? ""}
            placeholder="Ex : École Jules Ferry, cabinet d'orthophonie…"
            className={INPUT}
          />
        </div>
      )}
      <div>
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12`}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <Notice error={state.error} info={state.info} />
    </form>
  );
}
