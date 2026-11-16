"use client";

import { useActionState } from "react";
import {
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from "@/app/auth/actions";

const INPUT =
  "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

const SUBMIT =
  "w-full rounded-full bg-brand px-7 py-3 font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-60";

function Messages({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p className="rounded-xl bg-brand-dark/10 px-4 py-3 text-sm font-semibold text-brand-dark">
        {state.error}
      </p>
    );
  if (state.info)
    return (
      <p className="rounded-xl bg-peche/30 px-4 py-3 text-sm font-semibold text-aubergine">
        {state.info}
      </p>
    );
  return null;
}

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(requestPasswordReset, {
    error: initialError,
  });
  return (
    <form action={action} className="mt-6 space-y-4">
      <input
        name="email"
        type="email"
        required
        placeholder="Ton email"
        autoComplete="email"
        className={INPUT}
      />
      <Messages state={state} />
      {!state.info && (
        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? "Envoi…" : "Recevoir le lien"}
        </button>
      )}
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input
        name="password"
        type="password"
        required
        minLength={6}
        placeholder="Nouveau mot de passe (6 caractères min.)"
        autoComplete="new-password"
        className={INPUT}
      />
      <input
        name="confirmation"
        type="password"
        required
        minLength={6}
        placeholder="Le même, une deuxième fois"
        autoComplete="new-password"
        className={INPUT}
      />
      <Messages state={state} />
      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? "Enregistrement…" : "Enregistrer mon mot de passe"}
      </button>
    </form>
  );
}
