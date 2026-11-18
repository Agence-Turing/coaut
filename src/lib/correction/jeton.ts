import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Correction } from "./filtre";

/**
 * Jeton de relecture : quand l'auteur relit ses corrections, le texte a déjà
 * été vérifié (modération) et corrigé. Le jeton, signé par le serveur, garde ce
 * texte, ses corrections et le résultat de la modération : à l'envoi final, le
 * serveur vérifie que le texte reçu n'en diffère que par les corrections, sans
 * refaire attendre l'auteur. Sans secret, pas de jeton : la modération repasse.
 */

export type Revue = {
  texte: string;
  corrections: Correction[];
  /** Résultat de la modération du texte d'origine. */
  statut: "ok" | "review";
  auteur: string;
  livre: string;
  expire: number;
};

const DUREE_MS = 2 * 60 * 60 * 1000;

function secret(): string | null {
  return (
    process.env.CORRECTION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_SECRET ||
    process.env.CRON_SECRET ||
    null
  );
}

function signer(donnees: string, cle: string): string {
  return createHmac("sha256", cle).update(`correction:${donnees}`).digest("base64url");
}

export function signerRevue(revue: Omit<Revue, "expire">): string | null {
  const cle = secret();
  if (!cle) return null;
  const donnees = Buffer.from(
    JSON.stringify({ ...revue, expire: Date.now() + DUREE_MS })
  ).toString("base64url");
  return `${donnees}.${signer(donnees, cle)}`;
}

export function lireRevue(
  jeton: string,
  attendu: { auteur: string; livre: string }
): Revue | null {
  const cle = secret();
  if (!cle || !jeton) return null;
  const [donnees, signature] = jeton.split(".");
  if (!donnees || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(signer(donnees, cle));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const revue = JSON.parse(Buffer.from(donnees, "base64url").toString()) as Revue;
    if (revue.expire < Date.now()) return null;
    if (revue.auteur !== attendu.auteur || revue.livre !== attendu.livre) return null;
    return revue;
  } catch {
    return null;
  }
}
