"use client";

import { useActionState } from "react";
import { cancelMyBook, setMyBookPlaces, type ActionState } from "@/app/books/actions";
import { BTN_SECONDARY, INPUT, LABEL, Notice } from "@/components/ui";

/**
 * Réglages du lanceur sur la page de son livre en cours (réunion du 24/11) : nombre de
 * co-auteurs (livre public) et annulation du livre tant que personne n'a écrit.
 * Les règles sont vérifiées par les actions serveur et par la base (migration 0017).
 */
export default function LauncherSettings({
  bookRef,
  maxPlayers,
  teamSize,
  showPlaces,
  cancellable,
  isClassBook,
}: {
  bookRef: string;
  maxPlayers: number | null;
  teamSize: number;
  showPlaces: boolean;
  cancellable: boolean;
  isClassBook: boolean;
}) {
  const [placesState, placesAction, placesPending] = useActionState<ActionState, FormData>(
    setMyBookPlaces,
    {}
  );
  const [cancelState, cancelAction, cancelPending] = useActionState<ActionState, FormData>(
    cancelMyBook,
    {}
  );
  const min = Math.max(2, teamSize);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line p-5 sm:p-6">
      <h2 className="font-display text-2xl font-bold leading-tight">Ton livre</h2>

      {showPlaces && (
        <form action={placesAction} className="flex flex-col gap-2">
          <input type="hidden" name="book_ref" value={bookRef} />
          <label htmlFor="max_players" className={LABEL}>
            Nombre de co-auteurs (toi compris)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="max_players"
              type="number"
              name="max_players"
              min={min}
              max={Math.max(10, min)}
              required
              defaultValue={maxPlayers ?? Math.max(min, 3)}
              className={`${INPUT} w-28`}
            />
            <button type="submit" disabled={placesPending} className={BTN_SECONDARY}>
              {placesPending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
          <p className="text-sm text-muted">
            Entre 2 et 10, et pas moins que ton équipe actuelle ({teamSize}). Si tu baisses jusqu&rsquo;à
            ton équipe, elle est au complet et l&rsquo;écriture continue.
          </p>
          <Notice error={placesState.error} info={placesState.info} />
        </form>
      )}

      {cancellable && (
        <form
          action={cancelAction}
          className={`flex flex-col items-start gap-2 ${showPlaces ? "border-t border-line pt-4" : ""}`}
        >
          <input type="hidden" name="book_ref" value={bookRef} />
          <p className="text-sm text-muted">
            Personne n&rsquo;a encore écrit : tu peux annuler ce livre. Il disparaît du site
            {isClassBook ? " et de ta classe" : ", avec son équipe et les demandes pour le rejoindre"}.
          </p>
          <button
            type="submit"
            disabled={cancelPending}
            onClick={(e) => {
              if (!confirm("Annuler ce livre ? Il sera supprimé définitivement.")) e.preventDefault();
            }}
            className={BTN_SECONDARY}
          >
            {cancelPending ? "Annulation…" : "Annuler ce livre"}
          </button>
          <Notice error={cancelState.error} />
        </form>
      )}
    </section>
  );
}
