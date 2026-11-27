/**
 * Collecte des erreurs de prod vers GlitchTip (https://errors.agence-turing.fr, projet `coaut`),
 * avec le SDK Sentry officiel. Méthode : turing-docs/methodes/collecte-erreurs-glitchtip.md.
 *
 * Sans DSN, rien n'est envoyé : le DSN n'est donné qu'au build et au conteneur de production
 * (NEXT_PUBLIC_SENTRY_DSN figée au build, SENTRY_DSN côté serveur). Dev, tests et préprod n'en ont pas.
 */
import * as Sentry from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "./filtre";

/** DSN du navigateur, figé au build (vide hors production). */
export const clientDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

/** Options communes navigateur / serveur. */
export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: "production",
    // sha git court, passé au build par scripts/prod/build-image.sh.
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    // Ni IP, ni cookies, ni corps de requête : l'id de la fiche auteur et le rôle suffisent.
    sendDefaultPii: false,
    // Erreurs seulement : sans tracesSampleRate, pas de mesure de performance.
    // Jamais les variables locales des fonctions (elles peuvent tenir le texte d'un tour).
    includeLocalVariables: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

/** Erreur attrapée par une page d'erreur (error.tsx, global-error.tsx). */
export function reportError(error: unknown): void {
  if (!clientDsn) return;
  Sentry.captureException(error);
}

export type ReportedRole = "admin" | "adult" | "student";

/** Utilisateur des événements suivants : id de la fiche auteur et rôle, jamais pseudo ni e-mail. */
export function setReportedUser(user: { id: string; role: ReportedRole } | null): void {
  if (!clientDsn) return;
  Sentry.setUser(user);
}
