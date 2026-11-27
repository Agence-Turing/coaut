// Collecte des erreurs du navigateur (GlitchTip). Sans DSN au build, rien n'est chargé ni envoyé.
import * as Sentry from "@sentry/nextjs";
import { clientDsn, sentryOptions } from "@/lib/error-reporting";

if (clientDsn) {
  try {
    Sentry.init(sentryOptions(clientDsn));
  } catch {
    // La collecte ne doit jamais empêcher l'appli de démarrer.
  }
}
