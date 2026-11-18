"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  resendConfirmation,
  signIn,
  signUp,
} from "@/app/auth/actions";
import ProfessionalFields from "@/components/ProfessionalFields";
import { BTN_PRIMARY, HINT, INPUT, LABEL, LINK, Notice } from "@/components/ui";

/** Renvoi du mail de confirmation, proposé tant que l'adresse n'est pas confirmée. */
function ResendConfirmation({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendConfirmation, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3 text-center">
      <input type="hidden" name="email" value={email} />
      <Notice error={state.error} info={state.info} />
      <button
        type="submit"
        disabled={pending}
        className={`${LINK} min-h-11 text-sm disabled:opacity-60`}
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
    <div className="w-full max-w-[440px] rounded-2xl border border-line p-6 sm:p-8">
      <div role="tablist" aria-label="Accès au compte" className="grid grid-cols-2 border-b border-line">
        {(
          [
            ["login", "Me connecter"],
            ["signup", "M'inscrire"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={`-mb-px min-h-11 border-b-[3px] text-base transition-colors ${
              mode === key
                ? "border-brand font-semibold text-ink"
                : "border-transparent font-medium text-subtle hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <>
          <form action={loginAction} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className={LABEL}>
                Ton email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                placeholder="prenom@exemple.fr"
                autoComplete="email"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="login-password" className={LABEL}>
                  Ton mot de passe
                </label>
                <Link href="/mot-de-passe-oublie" className={`${LINK} text-sm`}>
                  Mot de passe oublié ?
                </Link>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className={INPUT}
              />
            </div>
            <Notice error={loginState.error} info={loginState.info} />
            <button
              type="submit"
              disabled={loginPending}
              className={`${BTN_PRIMARY} min-h-13 w-full text-[17px]`}
            >
              {loginPending ? "Connexion…" : "Me connecter"}
            </button>
          </form>
          {loginState.pendingEmail && (
            <ResendConfirmation email={loginState.pendingEmail} />
          )}
        </>
      ) : (
        <>
          <form action={signupAction} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-nickname" className={LABEL}>
                Ton pseudonyme d&rsquo;auteur
              </label>
              <input
                id="signup-nickname"
                name="nickname"
                type="text"
                required
                minLength={3}
                autoComplete="username"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-email" className={LABEL}>
                Ton email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                required
                placeholder="prenom@exemple.fr"
                autoComplete="email"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-birth" className={LABEL}>
                Ta date de naissance
              </label>
              <input
                id="signup-birth"
                name="birth_date"
                type="date"
                required
                autoComplete="bday"
                aria-describedby="signup-birth-hint"
                className={INPUT}
              />
              <p id="signup-birth-hint" className={HINT}>
                Elle reste privée : elle sert à te proposer des livres de ton
                âge.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-password" className={LABEL}>
                Un mot de passe
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                className={INPUT}
              />
            </div>
            <ProfessionalFields idPrefix="signup" />
            <Notice error={signupState.error} info={signupState.info} />
            <button
              type="submit"
              disabled={signupPending}
              className={`${BTN_PRIMARY} min-h-13 w-full text-[17px]`}
            >
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
