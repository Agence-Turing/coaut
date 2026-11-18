"use client";

import { useState } from "react";
import { INPUT, LABEL } from "@/components/ui";

/** Case « je travaille avec des enfants » + établissement : ouvre « Mes classes », sans validation. */
export default function ProfessionalFields({
  idPrefix,
  isProfessional = false,
  organization = null,
}: {
  idPrefix: string;
  isProfessional?: boolean;
  organization?: string | null;
}) {
  const [checked, setChecked] = useState(isProfessional);
  return (
    <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-organization`} className={LABEL}>
            Établissement ou structure
          </label>
          <input
            id={`${idPrefix}-organization`}
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
    </div>
  );
}
