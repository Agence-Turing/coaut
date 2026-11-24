"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getBook, getTurns, openToJoin, pendingReviewOf, placesLeft, writingState } from "@/lib/books";
import { createClassBook } from "@/app/classes/actions";
import {
  notifyBookPublished,
  notifyBookStarts,
  notifyJoinAnswer,
  notifyJoinRequest,
  notifyYourTurn,
} from "@/lib/mail/notify";
import { checkText, recordPublished, type CheckResult } from "@/lib/moderation";
import { verifierReconstruction, type Correction } from "@/lib/correction/filtre";
import { lireRevue, signerRevue } from "@/lib/correction/jeton";
import { normaliserThemes } from "@/lib/themes";

export type ActionState = {
  error?: string;
  info?: string;
  /** Fautes trouvées à l'envoi d'un tour : l'auteur les relit avant d'envoyer. */
  revue?: { texte: string; corrections: Correction[]; jeton: string | null };
};

const AUTHOR_MISSING =
  "Ta fiche auteur n'existe pas encore (policies RLS manquantes côté Supabase). Exécute supabase/migrations/0004_auth_policies.sql puis recharge la page.";

export async function createBook(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // Livre réservé à une classe : voir src/app/classes/actions.ts.
  if (formData.get("visibility") === "class") return createClassBook(_prev, formData);

  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return { error: AUTHOR_MISSING };

  const title = String(formData.get("title") ?? "").trim();
  const synopsis = String(formData.get("synopsis") ?? "").trim();
  const scolarLevel = String(formData.get("scolar_level") ?? "").trim();
  const maxPlayers = Number(formData.get("max_players") ?? 0);
  const themes = normaliserThemes(String(formData.get("themes") ?? ""));

  if (title.length < 3) return { error: "Donne un titre à ton histoire (3 caractères minimum)." };
  if (synopsis.length < 20)
    return { error: "Écris un synopsis un peu plus complet (20 caractères minimum) : c'est lui qui donnera envie de te rejoindre !" };
  if (!maxPlayers || maxPlayers < 2 || maxPlayers > 10)
    return { error: "Choisis un nombre de co-auteurs entre 2 et 10 (toi compris)." };

  // Modération : titre, thèmes et résumé sont visibles de tous.
  const moderated = {
    text: `Titre : ${title}\nThèmes : ${themes.join(", ") || "aucun"}\nRésumé : ${synopsis}`,
    kind: "book" as const,
    authorId: user.authorId,
  };
  const check = await checkText(moderated);
  if (!check.ok) return { error: check.message };

  const supabase = await createClient();
  const { data: book, error } = await supabase
    .from("books")
    .insert({
      title,
      synopsis,
      themes,
      scolar_level: scolarLevel || null,
      status: "launched",
      launcher_id: user.authorId,
      max_players: maxPlayers,
    })
    .select("id")
    .single();
  if (error || !book) {
    return { error: `Impossible de lancer le livre : ${error?.message ?? "erreur inconnue"}` };
  }

  await supabase.from("book_players").insert({
    book_id: book.id,
    author_id: user.authorId,
    position: 0,
  });

  after(() => recordPublished({ ...moderated, bookId: book.id, refId: book.id }, check));

  redirect(`/books/${book.id}`);
}

export async function requestJoin(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return { error: AUTHOR_MISSING };

  const bookId = String(formData.get("book_id") ?? "");
  const bookRef = String(formData.get("book_ref") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 10)
    return { error: "Écris un petit message au lanceur (10 caractères minimum) pour te présenter." };

  // Livre fermé (équipe au complet, terminé, de classe) ou déjà le sien : pas de demande.
  // La base le refuse aussi (migration 0013).
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("books")
    .select("status, class_id, max_players, launcher_id, book_players(author_id)")
    .eq("id", bookId)
    .maybeSingle();
  if (!target) return { error: "Livre introuvable." };
  if (
    target.launcher_id === user.authorId ||
    target.book_players.some((p) => p.author_id === user.authorId)
  )
    return { error: "Tu fais déjà partie de l'équipe de ce livre." };
  if (!openToJoin(target))
    return { error: "L'équipe de ce livre est au complet : il n'est plus possible de la rejoindre." };

  const moderated = {
    text: message,
    kind: "join_request" as const,
    authorId: user.authorId,
    bookId,
  };
  const check = await checkText(moderated);
  if (!check.ok) return { error: check.message };

  const { data: created, error } = await supabase
    .from("join_requests")
    .insert({
      book_id: bookId,
      author_id: user.authorId,
      message,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return { error: "Tu as déjà envoyé une demande pour ce livre." };
    return { error: `Demande impossible : ${error.message}` };
  }

  const requesterId = user.authorId;
  after(async () => {
    await recordPublished({ ...moderated, refId: created?.id ?? null }, check);
    await notifyJoinRequest(bookId, requesterId);
  });

  revalidatePath(`/books/${bookRef}`);
  return { info: "Demande envoyée ! Le lanceur du livre va te répondre." };
}

async function launcherAndRequest(requestId: string) {
  const user = await getCurrentUser();
  if (!user?.authorId) return { error: AUTHOR_MISSING } as const;

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("join_requests")
    .select("id, status, book_id, author_id, books(launcher_id)")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Demande introuvable." } as const;

  const launcherId = (request.books as unknown as { launcher_id: string | null })
    ?.launcher_id;
  if (launcherId !== user.authorId)
    return { error: "Seul le lanceur du livre peut répondre aux demandes." } as const;

  return { supabase, request } as const;
}

export async function acceptRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const bookRef = String(formData.get("book_ref") ?? "");
  const result = await launcherAndRequest(requestId);
  if ("error" in result) return;
  const { supabase, request } = result;

  const [{ count }, { data: bookRow }] = await Promise.all([
    supabase
      .from("book_players")
      .select("*", { count: "exact", head: true })
      .eq("book_id", request.book_id),
    supabase.from("books").select("max_players").eq("id", request.book_id).maybeSingle(),
  ]);
  // Équipe déjà au complet : la demande reste en attente.
  if (bookRow?.max_players && (count ?? 0) >= bookRow.max_players) return;

  await supabase
    .from("join_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);
  await supabase.from("book_players").insert({
    book_id: request.book_id,
    author_id: request.author_id,
    position: count ?? 0,
  });

  // Mails : réponse au demandeur, et « à toi d'écrire » si le livre peut démarrer ou reprendre
  // (équipe qui vient d'être au complet).
  after(async () => {
    await notifyJoinAnswer(request.book_id, request.author_id, true);
    await notifyBookStarts(request.book_id);
  });

  revalidatePath(`/books/${bookRef}`);
}

export async function saveTurn(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return { error: AUTHOR_MISSING };

  const bookRef = String(formData.get("book_ref") ?? "");
  const finish = formData.get("finish") === "1";
  const content = String(formData.get("content") ?? "").trim();

  if (finish && content.length < 30)
    return { error: "Écris au moins quelques phrases avant de terminer ton tour (30 caractères minimum)." };
  if (!finish && content.length === 0)
    return { error: "Ton brouillon est vide." };

  const book = await getBook(bookRef);
  if (!book) return { error: "Livre introuvable." };
  if (book.status !== "launched")
    return { error: "Ce livre est publié, l'écriture est terminée." };

  const turns = await getTurns(book.id);
  const state = writingState(book, turns);
  if (state.pendingReview)
    return { error: "Le tour précédent est en relecture par l'enseignant. Reviens un peu plus tard." };
  if (state.waitingForTeam)
    return {
      error: `En attente de l'équipe : ${placesLeft(state.waitingForTeam)}. L'écriture reprend dès que l'équipe est au complet.`,
    };
  if (state.currentAuthorId !== user.authorId)
    return {
      error: `Ce n'est pas ton tour d'écrire${state.currentNickname ? ` — c'est celui de ${state.currentNickname}` : ""}.`,
    };

  // Modération et correction des fautes au moment où le tour devient visible (le brouillon,
  // lui, n'est montré à personne), en un seul passage. Bloqué : rien n'est enregistré, le texte
  // reste dans l'éditeur. Des fautes : l'auteur les relit (CorrectionsRevue) puis renvoie son
  // texte avec le jeton signé ; s'il ne diffère de l'original que par les corrections, la
  // modération n'est pas refaite.
  const moderated = {
    text: content,
    kind: "turn" as const,
    authorId: user.authorId,
    bookId: book.id,
    bookTitle: book.title,
  };
  let check: CheckResult | null = null;
  if (finish && formData.get("revu") === "1") {
    const revue = lireRevue(String(formData.get("jeton") ?? ""), {
      auteur: user.authorId,
      livre: book.id,
    });
    check =
      revue && verifierReconstruction(revue.texte, content, revue.corrections)
        ? { ok: true, status: revue.statut }
        : await checkText(moderated);
  } else if (finish) {
    check = await checkText({
      ...moderated,
      correction: {
        resume: book.synopsis,
        tours: turns.filter((t) => t.id !== state.openTurn?.id).map((t) => t.content),
      },
    });
    if (check.ok && check.corrections?.length) {
      const jeton = signerRevue({
        texte: content,
        corrections: check.corrections,
        statut: check.status,
        auteur: user.authorId,
        livre: book.id,
      });
      return { revue: { texte: content, corrections: check.corrections, jeton } };
    }
  }
  if (check && !check.ok) return { error: check.message };

  const supabase = await createClient();
  const payload = {
    content,
    is_ended: finish,
    // Livre de classe avec relecture : le tour attend la validation du prof.
    is_validated: finish && !book.teacher_review,
  };
  const updateTurn = (id: string) =>
    supabase.from("turns").update(payload).eq("id", id).select("id").maybeSingle();
  let { data: saved, error } = state.openTurn
    ? await updateTurn(state.openTurn.id)
    : await supabase
        .from("turns")
        .insert({
          ...payload,
          book_id: book.id,
          number: state.number,
          author_id: user.authorId,
        })
        .select("id")
        .single();
  // 23505 : la sauvegarde automatique du brouillon (perte du focus au clic sur « Terminer »,
  // texte collé juste avant) a ouvert ce tour entre notre lecture et notre écriture. C'est le
  // même tour, du même auteur : on le termine au lieu d'échouer.
  if (error?.code === "23505" && !state.openTurn) {
    const { data: draftTurn } = await supabase
      .from("turns")
      .select("id")
      .eq("book_id", book.id)
      .eq("number", state.number)
      .eq("author_id", user.authorId)
      .eq("is_ended", false)
      .maybeSingle();
    if (draftTurn) ({ data: saved, error } = await updateTurn(draftTurn.id));
  }
  if (error) {
    if (error.code === "23505")
      return { error: "Un autre tour vient d'être enregistré, recharge la page." };
    return { error: `Enregistrement impossible : ${error.message}` };
  }

  if (finish && check?.ok) {
    const writerId = user.authorId;
    const turnId = saved?.id ?? state.openTurn?.id ?? null;
    after(async () => {
      await recordPublished({ ...moderated, refId: turnId }, check);
      await notifyYourTurn(book.id, writerId);
    });
  }

  revalidatePath(`/books/${bookRef}`);
  return finish
    ? book.teacher_review
      ? { info: "Ton tour est terminé ! Ton enseignant va le relire avant de passer la plume." }
      : { info: "Ton tour est terminé ! Au suivant d'écrire la suite." }
    : { info: "Brouillon enregistré. Tu peux reprendre quand tu veux." };
}

export async function publishBook(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return { error: AUTHOR_MISSING };

  const bookRef = String(formData.get("book_ref") ?? "");
  const book = await getBook(bookRef);
  if (!book) return { error: "Livre introuvable." };
  if (book.launcher_id !== user.authorId)
    return { error: "Seul le lanceur du livre peut le publier." };
  if (book.status === "published") return { error: "Ce livre est déjà publié." };

  const turns = await getTurns(book.id);
  const ended = turns.filter((t) => t.is_ended && t.content);
  if (ended.length === 0)
    return { error: "Impossible de publier un livre sans aucun tour écrit." };

  if (pendingReviewOf(book, turns))
    return { error: "Un tour attend ta relecture : valide-le ou renvoie-le avant de publier." };

  const openTurn = turns.find((t) => !t.is_ended);
  // Un livre Co-Aut s'écrit à plusieurs : pas de publication d'un livre écrit seul.
  if (!book.class_id) {
    const writers = new Set(ended.map((t) => t.author_id));
    if (openTurn?.content?.trim()) writers.add(openTurn.author_id);
    if (writers.size < 2)
      return {
        error: "Un livre Co-Aut s'écrit à plusieurs : il pourra être publié quand au moins un co-auteur aura écrit son tour.",
      };
  }
  if (openTurn && openTurn.author_id !== user.authorId)
    return {
      error: "Un tour d'écriture est en cours : attends qu'il soit terminé pour publier.",
    };

  // Ton brouillon devient visible à la publication : il passe la même vérification qu'un tour.
  const draftCheck = openTurn?.content?.trim()
    ? await checkText({
        text: openTurn.content,
        kind: "turn",
        authorId: user.authorId,
        bookId: book.id,
        bookTitle: book.title,
      })
    : null;
  if (draftCheck && !draftCheck.ok)
    return { error: `Ton brouillon n'a pas pu être publié. ${draftCheck.message}` };

  const supabase = await createClient();
  if (openTurn) {
    // Ton propre brouillon : on le clôt (il ne sera affiché que s'il a du contenu).
    await supabase
      .from("turns")
      .update({ is_ended: true, is_validated: Boolean(openTurn.content) })
      .eq("id", openTurn.id);
  }
  const { error } = await supabase
    .from("books")
    .update({ status: "published" })
    .eq("id", book.id);
  if (error) return { error: `Publication impossible : ${error.message}` };

  const publisherId = user.authorId;
  after(async () => {
    if (openTurn?.content && draftCheck?.ok) {
      await recordPublished(
        {
          text: openTurn.content,
          kind: "turn",
          authorId: publisherId,
          bookId: book.id,
          refId: openTurn.id,
        },
        draftCheck
      );
    }
    await notifyBookPublished(book.id, publisherId);
  });

  revalidatePath(`/books/${bookRef}`);
  return { info: "📖 Ton livre est publié ! Il rejoint la bibliothèque de Co-Aut." };
}

export async function toggleFavorite(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return;

  const bookId = String(formData.get("book_id") ?? "");
  const bookRef = String(formData.get("book_ref") ?? "");
  const isFavorite = formData.get("is_favorite") === "1";

  const supabase = await createClient();
  if (isFavorite) {
    await supabase
      .from("favorites")
      .delete()
      .eq("book_id", bookId)
      .eq("author_id", user.authorId);
  } else {
    await supabase
      .from("favorites")
      .insert({ book_id: bookId, author_id: user.authorId });
  }

  revalidatePath(`/books/${bookRef}`);
  revalidatePath("/bibliotheque");
  revalidatePath("/books/mes-livres");
}

export async function rejectRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  const bookRef = String(formData.get("book_ref") ?? "");
  const result = await launcherAndRequest(requestId);
  if ("error" in result) return;

  await result.supabase
    .from("join_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  const { book_id, author_id } = result.request;
  after(() => notifyJoinAnswer(book_id, author_id, false));

  revalidatePath(`/books/${bookRef}`);
}
