import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewWithClaude, type AiCategory, type TextKind } from "./ai";
import { findContact } from "./contacts";
import { categoryMessage, contactMessage, type BlockCategory } from "./messages";
import { corrigerTour, type Correction } from "@/lib/correction";

export type { TextKind } from "./ai";

/**
 * Vérification d'un texte avant envoi : point d'entrée unique, appelé par chaque action serveur
 * qui publie un texte saisi par un utilisateur (tour, demande pour rejoindre, lancement de livre).
 * La correction orthographique (src/lib/correction/) passe dans le même appel, en parallèle de
 * la lecture par l'IA, quand l'appelant la demande (tours) : un seul temps d'attente.
 *
 * 1. Repérage des coordonnées par le code (contacts.ts), sans IA : bloque tout de suite.
 * 2. Lecture par Claude Haiku (ai.ts). Panne ou délai dépassé : le texte passe, « à revoir »
 *    (status "review"), et la tâche /api/cron/moderation le relira.
 *
 * Chaque blocage est inscrit dans moderation_log (migration 0011) pour l'administration.
 */

export type TextToCheck = {
  text: string;
  kind: TextKind;
  authorId: string;
  bookId?: string | null;
  /** Titre du livre, donné à l'IA comme contexte. */
  bookTitle?: string | null;
  /** Demande aussi la correction des fautes (tours), avec le reste du livre comme contexte. */
  correction?: { resume?: string | null; tours?: (string | null)[] };
};

export type CheckResult =
  | {
      ok: true;
      /** "ok" = lu par l'IA ; "review" = IA indisponible, seul le repérage par le code est passé. */
      status: "ok" | "review";
      /** Panne de l'IA, pour le journal. */
      aiError?: string;
      /** Fautes à proposer à l'auteur (vide si non demandé ou si l'IA n'a pas répondu). */
      corrections?: Correction[];
    }
  | {
      ok: false;
      category: BlockCategory;
      /** Message à montrer à l'auteur, qui garde son texte pour le corriger. */
      message: string;
      /** Raison courte, pour l'administration. */
      reason: string;
      source: "regex" | "ai";
    };

export async function checkText(input: TextToCheck): Promise<CheckResult> {
  const text = input.text.trim();
  // Correction lancée tout de suite, en parallèle de la modération.
  const correction = input.correction
    ? corrigerTour(text, { titre: input.bookTitle, ...input.correction })
    : null;
  const corrections = async () => (correction ? (await correction).corrections : []);

  const contact = findContact(text);
  if (contact) {
    const result: CheckResult = {
      ok: false,
      category: "coordonnees",
      message: contactMessage(contact.kind, contact.match),
      reason: `Repéré par le code : ${contact.kind} « ${contact.match} »`,
      source: "regex",
    };
    await logBlock(input, result);
    return result;
  }

  const review = await reviewWithClaude(text, input.kind, {
    bookTitle: input.bookTitle ?? undefined,
  });
  if (review.status === "error") {
    console.error(`Modération IA indisponible (${input.kind}) : ${review.error}`);
    return { ok: true, status: "review", aiError: review.error, corrections: await corrections() };
  }
  if (review.verdict.verdict === "ok")
    return { ok: true, status: "ok", corrections: await corrections() };

  const category = review.verdict.categorie as BlockCategory;
  const result: CheckResult = {
    ok: false,
    category,
    message: categoryMessage(category, input.kind),
    reason: review.verdict.raison,
    source: "ai",
  };
  await logBlock(input, result);
  return result;
}

async function logBlock(input: TextToCheck, result: Extract<CheckResult, { ok: false }>) {
  const admin = createAdminClient();
  if (!admin) {
    console.error("Modération : blocage non journalisé (SUPABASE_SERVICE_ROLE_SECRET absente).");
    return;
  }
  const { error } = await admin.from("moderation_log").insert({
    author_id: input.authorId,
    book_id: input.bookId ?? null,
    kind: input.kind,
    content: input.text,
    verdict: "blocked",
    category: result.category,
    reason: result.reason,
    source: result.source,
    checked_at: new Date().toISOString(),
  });
  if (error) console.error("Modération : journal impossible :", error.message);
}

/**
 * À appeler une fois le texte enregistré : note le résultat sur le tour (moderation_status,
 * colonnes de l'administration) et, si l'IA n'a pas pu lire, inscrit le texte à relire.
 * N'échoue jamais : la publication est déjà faite.
 */
export async function recordPublished(
  input: TextToCheck & { refId: string | null },
  result: Extract<CheckResult, { ok: true }>
) {
  const admin = createAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  if (input.kind === "turn" && input.refId) {
    const { error } = await admin
      .from("turns")
      .update({ moderation_status: result.status, moderation_reason: null, moderated_at: now })
      .eq("id", input.refId);
    if (error) console.error("Modération : statut du tour non noté :", error.message);
  }
  if (result.status === "review") {
    const { error } = await admin.from("moderation_log").insert({
      author_id: input.authorId,
      book_id: input.bookId ?? null,
      kind: input.kind,
      ref_id: input.refId,
      content: input.text,
      verdict: "unverified",
      reason: result.aiError ? `IA indisponible : ${result.aiError}`.slice(0, 300) : null,
    });
    if (error) console.error("Modération : texte à relire non inscrit :", error.message);
  }
}

/** Nombre maximal de textes relus par passage de la tâche, et d'essais par texte. */
const RECHECK_BATCH = 30;
const RECHECK_MAX_ATTEMPTS = 12;

/**
 * Relecture par l'IA des textes publiés « non vérifiés » (tâche planifiée).
 * Jugé bloquant : la ligne passe en blocked_after et le tour en moderation_status = 'blocked'
 * (visible dans l'administration). Le texte n'est PAS dépublié automatiquement : il est déjà lu
 * par les co-auteurs, et le retirer casserait le fil de l'histoire ; c'est l'administration
 * qui décide (modifier ou supprimer le tour).
 */
export async function recheckPending() {
  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_SECRET absente" };

  const { data: rows, error } = await admin
    .from("moderation_log")
    .select("id, kind, ref_id, content, attempts, book_id")
    .eq("verdict", "unverified")
    .lt("attempts", RECHECK_MAX_ATTEMPTS)
    .order("created_at")
    .limit(RECHECK_BATCH);
  if (error) return { error: error.message };

  const summary = { relus: 0, ok: 0, bloques: 0, echecs: 0 };
  for (const row of rows ?? []) {
    const review = await reviewWithClaude(row.content, row.kind as TextKind);
    const now = new Date().toISOString();
    if (review.status === "error") {
      summary.echecs++;
      await admin
        .from("moderation_log")
        .update({ attempts: row.attempts + 1, reason: `IA indisponible : ${review.error}`.slice(0, 300) })
        .eq("id", row.id);
      // L'API est en panne : inutile d'insister sur le reste de la file.
      break;
    }
    summary.relus++;
    const blocked = review.verdict.verdict === "bloque";
    const category: AiCategory | null = blocked ? review.verdict.categorie : null;
    await admin
      .from("moderation_log")
      .update({
        verdict: blocked ? "blocked_after" : "ok_after",
        category,
        reason: review.verdict.raison,
        source: "ai",
        attempts: row.attempts + 1,
        checked_at: now,
      })
      .eq("id", row.id);
    if (row.kind === "turn" && row.ref_id) {
      await admin
        .from("turns")
        .update({
          moderation_status: blocked ? "blocked" : "ok",
          moderation_reason: blocked ? review.verdict.raison : null,
          moderated_at: now,
        })
        .eq("id", row.ref_id);
    }
    if (blocked) summary.bloques++;
    else summary.ok++;
  }
  return summary;
}
