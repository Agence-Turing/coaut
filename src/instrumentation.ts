// Collecte des erreurs serveur (rendu, route handlers, server actions, proxy) vers GlitchTip.
// DSN lu à l'exécution (SENTRY_DSN de /opt/coaut/app.env en prod) ; sans DSN, rien n'est envoyé.
import type { Instrumentation } from "next";

const serverDsn = () => process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";

export async function register() {
  const dsn = serverDsn();
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  const { sentryOptions } = await import("@/lib/error-reporting");
  Sentry.init(sentryOptions(dsn));
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!serverDsn() || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
