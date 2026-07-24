"use client";

import { useActionState } from "react";
import { createBook, type ActionState } from "@/app/books/actions";

const INPUT =
  "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

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
        <label htmlFor="title" className="mb-1 block text-sm font-bold text-ink">
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
        <label htmlFor="themes" className="mb-1 block text-sm font-bold text-ink">
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
            className="mb-1 block text-sm font-bold text-ink"
          >
            Ton niveau
          </label>
          <select id="scolar_level" name="scolar_level" className={INPUT} defaultValue="">
            <option value="">— Choisis un niveau —</option>
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
            className="mb-1 block text-sm font-bold text-ink"
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
        <label htmlFor="synopsis" className="mb-1 block text-sm font-bold text-ink">
          Le synopsis
        </label>
        <textarea
          id="synopsis"
          name="synopsis"
          required
          minLength={20}
          rows={6}
          placeholder="Présente ton histoire : c'est ce texte qui donnera envie aux autres co-auteurs de te rejoindre !"
          className={INPUT}
        />
      </div>

      {state.error && (
        <p className="rounded-xl bg-brand-dark/10 px-4 py-3 text-sm font-semibold text-brand-dark">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-brand px-7 py-3 font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Lancement…" : "Lancer mon livre 🚀"}
      </button>
    </form>
  );
}
