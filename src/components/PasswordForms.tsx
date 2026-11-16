"use client";

import { useActionState } from "react";
import { requestPasswordReset, updatePassword } from "@/app/auth/actions";
import { BTN_PRIMARY, INPUT, LABEL, Notice } from "@/components/ui";

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, {
    error: initialError,
  });
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-email" className={LABEL}>
          Ton email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          required
          placeholder="prenom@exemple.fr"
          autoComplete="email"
          className={INPUT}
        />
      </div>
      <Notice error={state.error} info={state.info} />
      {!state.info && (
        <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-13 w-full`}>
          {pending ? "Envoi…" : "Recevoir le lien"}
        </button>
      )}
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className={LABEL}>
          Nouveau mot de passe
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="6 caractères minimum"
          autoComplete="new-password"
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password-2" className={LABEL}>
          Le même, une deuxième fois
        </label>
        <input
          id="new-password-2"
          name="confirmation"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={INPUT}
        />
      </div>
      <Notice error={state.error} info={state.info} />
      <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-13 w-full`}>
        {pending ? "Enregistrement…" : "Enregistrer mon mot de passe"}
      </button>
    </form>
  );
}
