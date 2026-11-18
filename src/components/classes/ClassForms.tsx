"use client";

import { useActionState } from "react";
import { addStudents, createClass, type ClassActionState } from "@/app/classes/actions";
import { BTN_PRIMARY, BTN_SECONDARY, HINT, INPUT, LABEL, Notice } from "@/components/ui";

function StudentsFields({ idPrefix }: { idPrefix: string }) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-names`} className={`${LABEL} mb-1.5`}>
          Prénoms des élèves, un par ligne
        </label>
        <textarea
          id={`${idPrefix}-names`}
          name="first_names"
          rows={6}
          placeholder={"André\nLéa B.\nRobert"}
          className={INPUT}
        />
        <p className={`${HINT} mt-1.5`}>
          Pas de nom de famille. Deux prénoms identiques : ajoute une initiale.
        </p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-count`} className={`${LABEL} mb-1.5`}>
          Ou seulement un nombre d&rsquo;élèves (« Élève 1 », « Élève 2 »…)
        </label>
        <input
          id={`${idPrefix}-count`}
          name="count"
          type="number"
          min={1}
          max={40}
          className={`${INPUT} w-32`}
        />
      </div>
    </>
  );
}

export function CreateClassForm() {
  const [state, action, pending] = useActionState<ClassActionState, FormData>(createClass, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label htmlFor="class-name" className={`${LABEL} mb-1.5`}>
          Nom de la classe
        </label>
        <input
          id="class-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          placeholder="Ex : CM1 — École Jules Ferry"
          className={INPUT}
        />
      </div>
      <StudentsFields idPrefix="new" />
      <Notice error={state.error} info={state.info} />
      <div>
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-12`}>
          {pending ? "Création des codes…" : "Créer la classe"}
        </button>
      </div>
    </form>
  );
}

export function AddStudentsForm({ classId }: { classId: string }) {
  const [state, action, pending] = useActionState<ClassActionState, FormData>(addStudents, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="class_id" value={classId} />
      <StudentsFields idPrefix="add" />
      <Notice error={state.error} info={state.info} />
      <div>
        <button type="submit" disabled={pending} className={`${BTN_SECONDARY} min-h-12`}>
          {pending ? "Ajout…" : "Ajouter ces élèves"}
        </button>
      </div>
    </form>
  );
}

/** Bouton de formulaire avec confirmation (retirer un élève, passer un tour…). */
export function ConfirmButton({
  message,
  className,
  children,
}: {
  message: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
