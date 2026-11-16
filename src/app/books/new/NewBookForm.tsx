"use client";

import { useActionState } from "react";
import { createBook, type ActionState } from "@/app/books/actions";
import { BTN_PRIMARY, INPUT, LABEL, Notice } from "@/components/ui";

const LEVELS = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6eme",
  "5ème",
  "4ème",
  "3ème",
  "2nde",
  "1ère",
  "Terminale",
  "Enfant",
  "Adulte",
];

export default function NewBookForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBook,
    {}
  );

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="title" className={`${LABEL} mb-1.5`}>
          Le titre de ton histoire
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          placeholder="Ex : Le mystère de la forêt d'argent"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="themes" className={`${LABEL} mb-1.5`}>
          Le(s) thème(s), séparés par des virgules
        </label>
        <input
          id="themes"
          name="themes"
          type="text"
          placeholder="Ex : Aventure, Fantastique"
          className={INPUT}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="scolar_level"
            className={`${LABEL} mb-1.5`}
          >
            Ton niveau
          </label>
          <select id="scolar_level" name="scolar_level" className={INPUT} defaultValue="">
            <option value="">Choisis un niveau</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="max_players"
            className={`${LABEL} mb-1.5`}
          >
            Nombre de co-auteurs (toi compris)
          </label>
          <input
            id="max_players"
            name="max_players"
            type="number"
            required
            min={2}
            max={10}
            defaultValue={2}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label htmlFor="synopsis" className={`${LABEL} mb-1.5`}>
          Le résumé
        </label>
        <textarea
          id="synopsis"
          name="synopsis"
          required
          minLength={20}
          rows={6}
          placeholder="Présente ton histoire : c'est ce texte qui donnera envie aux autres co-auteurs de te rejoindre."
          className={INPUT}
        />
      </div>

      <Notice error={state.error} />

      <button
        type="submit"
        disabled={pending}
        className={`${BTN_PRIMARY} min-h-13 w-full text-[17px]`}
      >
        {pending ? "Lancement…" : "Lancer mon livre"}
      </button>
    </form>
  );
}
