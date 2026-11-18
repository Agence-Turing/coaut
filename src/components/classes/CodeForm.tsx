"use client";

import { useActionState } from "react";
import { enterWithCode, type CodeState } from "@/app/classe/actions";
import { BTN_PRIMARY, Notice } from "@/components/ui";

/** Le seul champ de l'espace classe : « Ton code ». */
export default function CodeForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(enterWithCode, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label htmlFor="code" className="font-display text-2xl font-bold text-ink">
        Ton code
      </label>
      <input
        id="code"
        name="code"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="LOUTRE-2510"
        className="block min-h-16 w-full rounded-xl border-2 border-ink bg-paper px-4 text-center text-2xl font-semibold uppercase tracking-[0.12em] text-ink placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ink/20"
      />
      <Notice error={state.error} />
      <button type="submit" disabled={pending} className={`${BTN_PRIMARY} min-h-14 text-lg`}>
        {pending ? "Un instant…" : "J'entre"}
      </button>
    </form>
  );
}
