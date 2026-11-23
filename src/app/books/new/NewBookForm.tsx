"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { createBook, type ActionState } from "@/app/books/actions";
import { BTN_PRIMARY, HINT, INPUT, LABEL, Notice } from "@/components/ui";
import { NIVEAUX } from "@/lib/niveaux";

export type ClassOption = { id: string; name: string; students: number };

/** `classes` : les classes du professionnel connecté (vide pour les autres : pas de choix Public / Classe). */
export default function NewBookForm({
  classes = [],
  defaultClassId,
}: {
  classes?: ClassOption[];
  defaultClassId?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createBook,
    {}
  );
  const [visibility, setVisibility] = useState<"public" | "class">(
    defaultClassId && classes.some((c) => c.id === defaultClassId) ? "class" : "public"
  );
  const forClass = visibility === "class";
  // Champs contrôlés : React vide le formulaire après l'action ; en cas de refus (modération ou
  // champ invalide), ce qui a été saisi doit rester pour être corrigé.
  const [fields, setFields] = useState({
    title: "",
    themes: "",
    scolar_level: "",
    max_players: "2",
    synopsis: "",
  });
  const bind = (name: keyof typeof fields) => ({
    name,
    value: fields[name],
    onChange: (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setFields((f) => ({ ...f, [name]: e.target.value })),
  });

  return (
    <form action={action} className="space-y-5">
      {classes.length > 0 && (
        <fieldset className="space-y-3 rounded-2xl border border-line p-4 sm:p-5">
          <legend className={`${LABEL} px-1`}>Pour qui ?</legend>
          <label className="flex min-h-11 items-start gap-3 text-[15px]">
            <input
              type="radio"
              name="visibility"
              value="public"
              checked={!forClass}
              onChange={() => setVisibility("public")}
              className="mt-0.5 h-5 w-5 flex-none accent-ink"
            />
            <span>
              <strong className="font-semibold">Public</strong> : tout le monde peut demander à rejoindre
            </span>
          </label>
          <label className="flex min-h-11 items-start gap-3 text-[15px]">
            <input
              type="radio"
              name="visibility"
              value="class"
              checked={forClass}
              onChange={() => setVisibility("class")}
              className="mt-0.5 h-5 w-5 flex-none accent-ink"
            />
            <span>
              <strong className="font-semibold">Réservé à ma classe</strong> : les élèves sont dans
              l&rsquo;équipe d&rsquo;office, personne d&rsquo;autre ne voit le livre avant sa publication
            </span>
          </label>

          {forClass && (
            <div className="space-y-4 border-t border-line pt-4">
              <div>
                <label htmlFor="class_id" className={`${LABEL} mb-1.5`}>
                  La classe
                </label>
                <select
                  id="class_id"
                  name="class_id"
                  required
                  defaultValue={defaultClassId ?? classes[0]?.id}
                  className={INPUT}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.students} élève{c.students > 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className={`${LABEL} mb-1.5`}>Ordre de passage</p>
                <div className="flex flex-wrap gap-x-6">
                  <label className="flex min-h-11 items-center gap-2 text-[15px]">
                    <input type="radio" name="order" value="list" defaultChecked className="h-5 w-5 accent-ink" />
                    Ordre de la liste
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-[15px]">
                    <input type="radio" name="order" value="random" className="h-5 w-5 accent-ink" />
                    Au hasard
                  </label>
                </div>
                <p className={HINT}>Tu pourras le changer ensuite sur la page du livre.</p>
              </div>
            </div>
          )}
        </fieldset>
      )}
      <div>
        <label htmlFor="title" className={`${LABEL} mb-1.5`}>
          Le titre de ton histoire
        </label>
        <input
          id="title"
          {...bind("title")}
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
          {...bind("themes")}
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
            {forClass ? "Niveau" : "Ton niveau"}
          </label>
          <select id="scolar_level" {...bind("scolar_level")} className={INPUT}>
            <option value="">Choisis un niveau</option>
            {NIVEAUX.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        {!forClass && (
        <div>
          <label
            htmlFor="max_players"
            className={`${LABEL} mb-1.5`}
          >
            Nombre de co-auteurs (toi compris)
          </label>
          <input
            id="max_players"
            {...bind("max_players")}
            type="number"
            required
            min={2}
            max={10}
            className={INPUT}
          />
        </div>
        )}
      </div>

      <div>
        <label htmlFor="synopsis" className={`${LABEL} mb-1.5`}>
          Le résumé
        </label>
        <textarea
          id="synopsis"
          {...bind("synopsis")}
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
