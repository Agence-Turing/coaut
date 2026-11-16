"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  resendConfirmation,
  signIn,
  signUp,
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

/** Renvoi du mail de confirmation, proposé tant que l'adresse n'est pas confirmée. */
function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, {});
  return (
    <form action={action} className="mt-4 space-y-3 text-center">
      <input type="hidden" name="email" value={email} />
      {(state.error || state.info) && <Messages state={state} />}
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-semibold text-brand hover:underline disabled:opacity-60"
      >
        {pending
          ? "Envoi…"
          : "Je n'ai rien reçu : renvoyer le mail de confirmation"}
      </button>
    </form>
  );
}

export default function AuthForm({
  initialMode,
  initialError,
}: {
  initialMode?: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">(
    initialMode === "signup" ? "signup" : "login",
  );
  const [loginState, loginAction, loginPending] = useActionState(signIn, {
    error: initialError,
  });
  const [signupState, signupAction, signupPending] = useActionState(signUp, {});

  return (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <div className="flex rounded-full bg-ink/5 p-1">
        {(
          [
            ["login", "Me connecter"],
            ["signup", "M'inscrire"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-colors ${
              mode === key
                ? "bg-aubergine text-white"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <>
          <form action={loginAction} className="mt-8 space-y-4">
            <input
              name="email"
              type="email"
              required
              placeholder="Ton email"
              autoComplete="email"
              className={INPUT}
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Ton mot de passe"
              autoComplete="current-password"
              className={INPUT}
            />
            <Messages state={loginState} />
            <button type="submit" disabled={loginPending} className={SUBMIT}>
              {loginPending ? "Connexion…" : "Me connecter"}
            </button>
            <p className="text-center text-sm">
              <Link
                href="/mot-de-passe-oublie"
                className="font-semibold text-brand hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </p>
          </form>
          {loginState.pendingEmail && (
            <ResendConfirmation email={loginState.pendingEmail} />
          )}
        </>
      ) : (
        <>
          <form action={signupAction} className="mt-8 space-y-4">
            <input
              name="nickname"
              type="text"
              required
              minLength={3}
              placeholder="Ton pseudonyme d'auteur"
              autoComplete="username"
              className={INPUT}
            />
            <p className="text-xs text-ink/50">
              C&rsquo;est lui que les autres co-auteurs verront — jamais ton
              nom.
            </p>
            <input
              name="email"
              type="email"
              required
              placeholder="Ton email"
              autoComplete="email"
              className={INPUT}
            />
            <label className="block text-sm font-semibold text-ink/70">
              Ta date de naissance
              <input
                name="birth_date"
                type="date"
                required
                autoComplete="bday"
                className={`${INPUT} mt-1`}
              />
            </label>
            <p className="text-xs text-ink/50">
              Elle reste privée : elle sert à te proposer des livres de ton âge.
            </p>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Un mot de passe (6 caractères min.)"
              autoComplete="new-password"
              className={INPUT}
            />
            <Messages state={signupState} />
            <button type="submit" disabled={signupPending} className={SUBMIT}>
              {signupPending ? "Création du compte…" : "Créer mon compte"}
            </button>
          </form>
          {signupState.pendingEmail && (
            <ResendConfirmation email={signupState.pendingEmail} />
          )}
        </>
      )}
    </div>
  );
}
