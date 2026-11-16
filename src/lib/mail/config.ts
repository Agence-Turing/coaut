import "server-only";

/** Délais des relances « à toi d'écrire », en jours après le premier mail. Pas de troisième relance. */
export const REMINDER_1_DAYS = 4;
export const REMINDER_2_DAYS = 8;

/** Adresse publique du site, pour les liens des mails. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "https://coaut.agence-turing.com").replace(/\/$/, "");
}

/**
 * Envoi SMTP, configuré par l'environnement :
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (facultatifs), SMTP_SECURE=1 pour le TLS implicite (port 465),
 * MAIL_FROM (ex. « Co-Aut <contact@co-aut.com> »). Sans SMTP_HOST, aucun mail ne part.
 */
export function smtpConfig() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const user = process.env.SMTP_USER;
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "1",
    auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
    from: process.env.MAIL_FROM ?? "Co-Aut <contact@co-aut.com>",
  };
}
