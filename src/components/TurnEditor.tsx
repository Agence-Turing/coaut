"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { saveTurn, type ActionState } from "@/app/books/actions";
import { BTN_PRIMARY, Notice } from "@/components/ui";
import CorrectionsRevue from "@/components/CorrectionsRevue";

/** Coups de pouce : une phrase d'aide, sans IA ni appel réseau. */
const TIPS = [
  {
    label: "Fais parler un personnage",
    help: "Ouvre un tiret et laisse quelqu'un dire ce qu'il pense, ce qu'il veut ou ce qu'il cache. Deux répliques suffisent à relancer la scène.",
  },
  {
    label: "Décris le lieu",
    help: "Où sommes-nous ? Donne un bruit, une odeur, une lumière : trois détails et le lecteur y est.",
  },
  {
    label: "Ajoute un imprévu",
    help: "Quelqu'un arrive, un objet disparaît, un secret éclate. Pose un problème que le co-auteur suivant devra résoudre.",
  },
] as const;

/** Délai après la dernière frappe avant la sauvegarde automatique. */
const ANTI_REBOND_MS = 2500;
/** Copie de secours gardée dans le navigateur (session ou réseau perdus). */
const SECOURS_JOURS = 14;

type Sauvegarde =
  | { etat: "rien" }
  | { etat: "en_cours" }
  | { etat: "ok"; a: Date }
  | { etat: "local" };

function lireSecours(cle: string): string | null {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const { texte, a } = JSON.parse(brut) as { texte: string; a: number };
    if (Date.now() - a > SECOURS_JOURS * 86_400_000) {
      localStorage.removeItem(cle);
      return null;
    }
    return typeof texte === "string" ? texte : null;
  } catch {
    return null;
  }
}

function ecrireSecours(cle: string, texte: string | null) {
  try {
    if (texte === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, JSON.stringify({ texte, a: Date.now() }));
  } catch {
    // Stockage indisponible (navigation privée) : la sauvegarde serveur suffit.
  }
}

const heure = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");

export default function TurnEditor({
  bookRef,
  number,
  draft,
  nickname,
}: {
  bookRef: string;
  /** Numéro du tour : la copie de secours lui est propre. */
  number: number;
  draft: string;
  nickname: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveTurn,
    {}
  );
  const [tip, setTip] = useState<number | null>(null);
  // Champ contrôlé : React vide les formulaires après une action ; un texte refusé par la
  // modération doit rester dans l'éditeur pour être corrigé.
  const [text, setText] = useState(draft);
  const length = text.length;

  // Sauvegarde automatique : sur le serveur (brouillon du tour) quelques secondes après la
  // frappe, à la perte du focus et à la fermeture de l'onglet ; et à chaque frappe dans le
  // navigateur, en secours si la session ou le réseau tombent.
  const cleSecours = `coaut:brouillon:${bookRef}:${number}`;
  const enregistre = useRef(draft.trim());
  const texteCourant = useRef(text);
  const [sauvegarde, setSauvegarde] = useState<Sauvegarde>({ etat: "rien" });
  // Pendant l'envoi du tour, plus de sauvegarde : elle croiserait « Terminer mon tour ».
  const envoi = useRef(false);
  useEffect(() => {
    texteCourant.current = text;
    envoi.current = pending;
  }, [text, pending]);

  const sauver = useCallback(
    async (fermeture = false) => {
      const contenu = texteCourant.current;
      if (envoi.current || contenu.trim() === enregistre.current) return;
      if (!fermeture) setSauvegarde({ etat: "en_cours" });
      try {
        const rep = await fetch("/api/brouillon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ book_ref: bookRef, content: contenu }),
          keepalive: fermeture,
        });
        if (!rep.ok) throw new Error(String(rep.status));
        enregistre.current = contenu.trim();
        const aJour = texteCourant.current.trim() === enregistre.current;
        // Le serveur a le texte : la copie de secours ne servirait qu'à écraser, sur un autre
        // jour ou appareil, un brouillon plus récent.
        if (aJour) ecrireSecours(cleSecours, null);
        if (!fermeture) setSauvegarde(aJour ? { etat: "ok", a: new Date() } : { etat: "en_cours" });
      } catch {
        if (!fermeture) setSauvegarde({ etat: "local" });
      }
    },
    [bookRef, cleSecours]
  );

  // Retour sur la page : la copie du navigateur, plus récente que le brouillon du serveur
  // (écrite à chaque frappe), reprend sa place puis repart au serveur.
  useEffect(() => {
    const secours = lireSecours(cleSecours);
    if (secours !== null && secours.trim() && secours.trim() !== draft.trim()) {
      // Le stockage du navigateur ne se lit qu'après le montage (rendu serveur).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(secours);
      texteCourant.current = secours;
      void sauver();
    }
    // Au montage seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pending || text.trim() === enregistre.current) return;
    ecrireSecours(cleSecours, text);
    const minuteur = setTimeout(() => void sauver(), ANTI_REBOND_MS);
    return () => clearTimeout(minuteur);
  }, [text, pending, cleSecours, sauver]);

  useEffect(() => {
    const partir = () => void sauver(true);
    const cache = () => document.visibilityState === "hidden" && partir();
    window.addEventListener("pagehide", partir);
    document.addEventListener("visibilitychange", cache);
    return () => {
      window.removeEventListener("pagehide", partir);
      document.removeEventListener("visibilitychange", cache);
    };
  }, [sauver]);

  // Tour envoyé : la copie de secours n'a plus d'objet.
  useEffect(() => {
    if (state.info && !state.error) ecrireSecours(cleSecours, null);
  }, [state, cleSecours]);
  // Fautes trouvées à l'envoi : relecture tant que l'auteur ne revient pas à son texte.
  const [revueFermee, setRevueFermee] = useState<ActionState | null>(null);
  const revue = state.revue && revueFermee !== state ? state.revue : null;

  if (revue)
    return (
      <CorrectionsRevue
        key={revue.jeton ?? revue.texte}
        texte={revue.texte}
        corrections={revue.corrections}
        jeton={revue.jeton}
        bookRef={bookRef}
        action={action}
        pending={pending}
        onTexte={setText}
        onRetour={(final) => {
          setText(final);
          setRevueFermee(state);
        }}
      />
    );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="book_ref" value={bookRef} />
      <label
        htmlFor="turn-content"
        className="font-display text-2xl font-bold leading-tight"
      >
        {nickname}, c&rsquo;est ton tour
      </label>
      <p className="text-[15px] leading-relaxed text-muted">
        Écris la suite de l&rsquo;histoire. Ton texte s&rsquo;enregistre tout
        seul : tu peux partir et revenir plus tard. Quand tu termines ton tour,
        la plume passe au co-auteur suivant.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Un coup de pouce ?</span>
          {TIPS.map((t, i) => (
            <button
              key={t.label}
              type="button"
              aria-expanded={tip === i}
              aria-controls="turn-tip"
              onClick={() => setTip(tip === i ? null : i)}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${
                tip === i
                  ? "border-ink bg-tint-orange text-ink"
                  : "border-line-strong bg-paper text-ink hover:border-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p
          id="turn-tip"
          aria-live="polite"
          className={
            tip === null
              ? "hidden"
              : "rounded-[10px] bg-tint-cream px-3.5 py-3 text-[15px] leading-relaxed text-ink"
          }
        >
          {tip !== null && TIPS[tip].help}
        </p>
      </div>

      <textarea
        id="turn-content"
        name="content"
        rows={8}
        value={text}
        placeholder="Que se passe-t-il ensuite ?"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          // Clic sur « Terminer mon tour » : l'envoi emporte le texte, une sauvegarde du
          // brouillon en même temps ne servirait à rien.
          if ((e.relatedTarget as HTMLElement | null)?.dataset?.envoi === "1") return;
          void sauver();
        }}
        className="block w-full resize-y rounded-xl border-2 border-ink bg-paper p-4 font-display text-xl leading-relaxed text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-ink/20"
      />

      <Notice error={state.error} info={state.info} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted" aria-live="polite">
          {length} caractère{length > 1 ? "s" : ""}
          {sauvegarde.etat === "ok" && <> · Enregistré à {heure(sauvegarde.a)}</>}
          {sauvegarde.etat === "en_cours" && <> · Enregistrement…</>}
          {sauvegarde.etat === "local" && (
            <> · Hors connexion : ton texte est gardé sur cet appareil</>
          )}
        </span>
        <button
          type="submit"
          name="finish"
          value="1"
          data-envoi="1"
          onPointerDown={() => (envoi.current = true)}
          disabled={pending}
          className={`${BTN_PRIMARY} min-h-12`}
        >
          {pending ? "Relecture…" : "Terminer mon tour"}
        </button>
      </div>
    </form>
  );
}
