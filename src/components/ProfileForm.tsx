"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/profil/actions";
import ProfessionalFields from "@/components/ProfessionalFields";
import { BTN_PRIMARY, INPUT, LABEL, Notice } from "@/components/ui";

/** Tout ce que l'auteur peut modifier dans son profil, avec un seul bouton. */
export default function ProfileForm({
  birthDate,
  maxDate,
  isProfessional,
  organization,
}: {
  birthDate: string | null;
  maxDate: string;
  isProfessional: boolean;
  organization: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profil-birth" className={LABEL}>
          Date de naissance
        </label>
        <input
          id="profil-birth"
          name="birth_date"
          type="date"
          required
          defaultValue={birthDate ?? ""}
          max={maxDate}
          className={`${INPUT} w-auto`}
        />
      </div>
      <ProfessionalFields
        idPrefix="profil"
        isProfessional={isProfessional}
        organization={organization}
      />
      <Notice error={state.error} info={state.info} />
      <div>
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12`}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
