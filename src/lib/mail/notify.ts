import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { REMINDER_1_DAYS, REMINDER_2_DAYS } from "./config";
import { sendToAuthor } from "./send";
import {
  bookPublishedMail,
  joinAnswerMail,
  joinRequestAdminMail,
  joinRequestMail,
  turnReminderMail,
  yourTurnMail,
} from "./templates";

/*
 * Mails automatiques de l'app. Toutes ces fonctions sont appelées après la réponse à
 * l'utilisateur (after()) et n'échouent jamais : un mail raté ne bloque aucune action.
 */

type BookRow = {
  id: string;
  legacy_code: string | null;
  title: string;
  status: string;
  launcher_id: string | null;
};

async function loadBook(admin: SupabaseClient, bookId: string): Promise<BookRow | null> {
  const { data } = await admin
    .from("books")
    .select("id, legacy_code, title, status, launcher_id")
    .eq("id", bookId)
    .maybeSingle();
  return (data as BookRow | null) ?? null;
}

const info = (book: BookRow) => ({
  title: book.title,
  path: `/books/${book.legacy_code ?? book.id}`,
});

/**
 * À qui le tour (même règle que writingState) : personne si le livre attend son équipe
 * (teamWaiting), sinon tour ouvert, sinon rotation de l'équipe.
 */
async function currentTurn(admin: SupabaseClient, bookId: string) {
  const [{ data: players }, { data: turns }, { data: book }] = await Promise.all([
    admin.from("book_players").select("author_id, position").eq("book_id", bookId).order("position"),
    admin.from("turns").select("number, is_ended, author_id").eq("book_id", bookId),
    admin.from("books").select("status, class_id, max_players").eq("id", bookId).maybeSingle(),
  ]);
  const team = players ?? [];
  const all = turns ?? [];
  const ended = all.filter((t) => t.is_ended).length;
  const open = all.find((t) => !t.is_ended);
  const maxNumber = all.reduce((m, t) => Math.max(m, t.number), 0);
  const waiting = Boolean(
    book?.status === "launched" &&
      !book.class_id &&
      book.max_players &&
      team.length < book.max_players &&
      ended > 0
  );
  const full = Boolean(book?.max_players && team.length >= book.max_players);
  if (waiting) return { authorId: null, number: open?.number ?? maxNumber + 1, ended, team, full };
  if (open) {
    return { authorId: open.author_id as string | null, number: open.number as number, ended, team, full };
  }
  if (team.length === 0) return { authorId: null, number: maxNumber + 1, ended, team, full };
  return {
    authorId: team[ended % team.length].author_id as string,
    number: maxNumber + 1,
    ended,
    team,
    full,
  };
}

/**
 * Prévient l'auteur dont c'est le tour. `exceptAuthorId` : celui qui vient d'agir
 * (inutile de lui écrire si le tour lui revient, livre à un seul auteur par exemple).
 */
export async function notifyYourTurn(bookId: string, exceptAuthorId?: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const book = await loadBook(admin, bookId);
    if (!book || book.status !== "launched") return;
    const turn = await currentTurn(admin, bookId);
    if (!turn.authorId || turn.authorId === exceptAuthorId) return;
    await sendToAuthor({
      kind: "your_turn",
      authorId: turn.authorId,
      bookId,
      turnNumber: turn.number,
      dedupeKey: `${bookId}:${turn.number}`,
      content: yourTurnMail(info(book), turn.ended === 0),
    });
  } catch (e) {
    console.error("notifyYourTurn :", e);
  }
}

/**
 * Un co-auteur vient d'entrer dans l'équipe : le livre démarre (rien n'est encore écrit) ou
 * reprend (l'équipe vient d'être au complet après le premier tour). currentTurn ne renvoie
 * personne tant que le livre attend son équipe ; le journal évite tout doublon.
 */
export async function notifyBookStarts(bookId: string, exceptAuthorId?: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const turn = await currentTurn(admin, bookId);
    if (turn.team.length < 2) return;
    // Livre déjà commencé : seulement si l'équipe est maintenant au complet.
    if (turn.ended > 0 && !turn.full) return;
    await notifyYourTurn(bookId, exceptAuthorId);
  } catch (e) {
    console.error("notifyBookStarts :", e);
  }
}

/**
 * Demande pour rejoindre : au lanceur. Si le livre n'a plus de lanceur joignable (pas de lanceur,
 * fiche sans compte, auteur supprimé, compte bloqué), la demande va aux admins du site, qui
 * peuvent ajouter le demandeur à l'équipe ou le faire lanceur depuis l'admin.
 */
export async function notifyJoinRequest(bookId: string, requesterAuthorId: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const book = await loadBook(admin, bookId);
    if (!book || book.launcher_id === requesterAuthorId) return;
    const { data: requester } = await admin
      .from("authors")
      .select("nickname")
      .eq("id", requesterAuthorId)
      .maybeSingle();
    const nickname = requester?.nickname ?? "Un auteur";

    if (book.launcher_id && (await reachable(admin, book.launcher_id))) {
      await sendToAuthor({
        kind: "join_request",
        authorId: book.launcher_id,
        bookId,
        dedupeKey: `${bookId}:${requesterAuthorId}`,
        content: joinRequestMail(info(book), nickname),
      });
      return;
    }

    const { data: admins } = await admin.from("admins").select("user_id");
    const userIds = (admins ?? []).map((a) => a.user_id as string);
    if (userIds.length === 0) return;
    const { data: adminAuthors } = await admin
      .from("authors")
      .select("id")
      .in("user_id", userIds)
      .is("deleted_at", null);
    for (const a of adminAuthors ?? []) {
      if (a.id === requesterAuthorId) continue;
      await sendToAuthor({
        kind: "join_request",
        authorId: a.id as string,
        bookId,
        dedupeKey: `${bookId}:${requesterAuthorId}:admin`,
        content: joinRequestAdminMail(
          { title: book.title, path: `/admin/livres/${book.id}` },
          nickname
        ),
      });
    }
  } catch (e) {
    console.error("notifyJoinRequest :", e);
  }
}

/** Le lanceur peut-il recevoir un mail : fiche avec compte, pas supprimée, compte pas bloqué. */
async function reachable(admin: SupabaseClient, authorId: string): Promise<boolean> {
  const [{ data: author }, { data: profile }] = await Promise.all([
    admin.from("authors").select("user_id, deleted_at").eq("id", authorId).maybeSingle(),
    admin.from("author_profiles").select("blocked_at").eq("author_id", authorId).maybeSingle(),
  ]);
  return Boolean(author?.user_id && !author.deleted_at && !profile?.blocked_at);
}

export async function notifyJoinAnswer(bookId: string, requesterAuthorId: string, accepted: boolean) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const book = await loadBook(admin, bookId);
    if (!book) return;
    await sendToAuthor({
      kind: accepted ? "join_accepted" : "join_rejected",
      authorId: requesterAuthorId,
      bookId,
      dedupeKey: bookId,
      content: joinAnswerMail(info(book), accepted),
    });
  } catch (e) {
    console.error("notifyJoinAnswer :", e);
  }
}

/** Livre publié : toute l'équipe est prévenue, sauf celui qui vient de publier. */
export async function notifyBookPublished(bookId: string, exceptAuthorId?: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const book = await loadBook(admin, bookId);
    if (!book) return;
    const { data: players } = await admin
      .from("book_players")
      .select("author_id")
      .eq("book_id", bookId);
    for (const p of players ?? []) {
      if (p.author_id === exceptAuthorId) continue;
      await sendToAuthor({
        kind: "book_published",
        authorId: p.author_id,
        bookId,
        dedupeKey: bookId,
        content: bookPublishedMail(info(book)),
      });
    }
  } catch (e) {
    console.error("notifyBookPublished :", e);
  }
}

/**
 * Relances « à toi d'écrire » (tâche planifiée). On part uniquement des mails « à toi d'écrire »
 * déjà envoyés : un tour pour lequel aucun mail n'est parti (tours ouverts repris de l'ancien
 * site, avant la mise en service) n'est jamais relancé.
 */
export async function sendTurnReminders(now: Date = new Date()) {
  const result = { examined: 0, reminder1: 0, reminder2: 0 };
  const admin = createAdminClient();
  if (!admin) return { ...result, error: "clé service absente" };

  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data: mails, error } = await admin
    .from("mail_log")
    .select("author_id, book_id, turn_number, sent_at")
    .eq("kind", "your_turn")
    .eq("status", "sent")
    .lte("sent_at", since(REMINDER_1_DAYS))
    // Au-delà, les deux relances sont forcément parties (ou le tour a été écrit).
    .gte("sent_at", since(REMINDER_2_DAYS + 30));
  if (error) return { ...result, error: error.message };

  for (const mail of mails ?? []) {
    if (!mail.author_id || !mail.book_id || mail.turn_number == null) continue;
    result.examined += 1;
    try {
      const book = await loadBook(admin, mail.book_id);
      if (!book || book.status !== "launched") continue;
      const turn = await currentTurn(admin, mail.book_id);
      // Le tour a été écrit, ou a changé de main : plus rien à relancer.
      if (turn.authorId !== mail.author_id || turn.number !== mail.turn_number) continue;

      const second = mail.sent_at <= since(REMINDER_2_DAYS);
      const key = `${mail.book_id}:${mail.turn_number}`;
      if (second) {
        // La première relance d'abord si elle n'est jamais partie (tâche arrêtée quelques jours).
        const first = await sendToAuthor({
          kind: "turn_reminder_1",
          authorId: mail.author_id,
          bookId: mail.book_id,
          turnNumber: mail.turn_number,
          dedupeKey: key,
          content: turnReminderMail(info(book), false),
        });
        if (first === "sent") {
          result.reminder1 += 1;
          continue;
        }
        const status = await sendToAuthor({
          kind: "turn_reminder_2",
          authorId: mail.author_id,
          bookId: mail.book_id,
          turnNumber: mail.turn_number,
          dedupeKey: key,
          content: turnReminderMail(info(book), true),
        });
        if (status === "sent") result.reminder2 += 1;
      } else {
        const status = await sendToAuthor({
          kind: "turn_reminder_1",
          authorId: mail.author_id,
          bookId: mail.book_id,
          turnNumber: mail.turn_number,
          dedupeKey: key,
          content: turnReminderMail(info(book), false),
        });
        if (status === "sent") result.reminder1 += 1;
      }
    } catch (e) {
      console.error("Relance :", e);
    }
  }
  return result;
}
