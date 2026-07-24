"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getBook, getTurns, writingState } from "@/lib/books";

export type ActionState = { error?: string; info?: string };

const AUTHOR_MISSING =
  "Ta fiche auteur n'existe pas encore (policies RLS manquantes côté Supabase). Exécute supabase/migrations/0004_auth_policies.sql puis recharge la page.";

export async function createBook(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId) return { error: AUTHOR_MISSING };

  const title = String(formData.get("title") ?? "").trim();
  const synopsis = String(formData.get("synopsis") ?? "").trim();
  const scolarLevel = String(formData.get("scolar_level") ?? "").trim();
  const maxPlayers = Number(formData.get("max_players") ?? 0);
  const themes = String(formData.get("themes") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (title.length < 3) return { error: "Donne un titre à ton histoire (3 caractères minimum)." };
  if (synopsis.length < 20)
    return { error: "Écris un synopsis un peu plus complet (20 caractères minimum) : c'est lui qui donnera envie de te rejoindre !" };
  if (!maxPlayers || maxPlayers < 2 || maxPlayers > 10)
    return { error: "Choisis un nombre de co-auteurs entre 2 et 10 (toi compris)." };

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

  const supabase = await createClient();
  const { error } = await supabase.from("join_requests").insert({
    book_id: bookId,
    author_id: user.authorId,
    message,
  });
  if (error) {
    if (error.code === "23505")
      return { error: "Tu as déjà envoyé une demande pour ce livre." };
    return { error: `Demande impossible : ${error.message}` };
  }

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

  await supabase
    .from("join_requests")
    .update({ status: "accepted" })
    .eq("id", requestId);

  const { count } = await supabase
    .from("book_players")
    .select("*", { count: "exact", head: true })
    .eq("book_id", request.book_id);
  await supabase.from("book_players").insert({
    book_id: request.book_id,
    author_id: request.author_id,
    position: count ?? 0,
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
  if (state.currentAuthorId !== user.authorId)
    return {
      error: `Ce n'est pas ton tour d'écrire${state.currentNickname ? ` — c'est celui de ${state.currentNickname}` : ""}.`,
    };

  const supabase = await createClient();
  const payload = {
    content,
    is_ended: finish,
    is_validated: finish,
  };
  const { error } = state.openTurn
    ? await supabase.from("turns").update(payload).eq("id", state.openTurn.id)
    : await supabase.from("turns").insert({
        ...payload,
        book_id: book.id,
        number: state.number,
        author_id: user.authorId,
      });
  if (error) {
    if (error.code === "23505")
      return { error: "Un autre tour vient d'être enregistré, recharge la page." };
    return { error: `Enregistrement impossible : ${error.message}` };
  }

  revalidatePath(`/books/${bookRef}`);
  return finish
    ? { info: "Ton tour est terminé ! Au suivant d'écrire la suite. ✍️" }
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

  const openTurn = turns.find((t) => !t.is_ended);
  if (openTurn && openTurn.author_id !== user.authorId)
    return {
      error: "Un tour d'écriture est en cours : attends qu'il soit terminé pour publier.",
    };

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

  revalidatePath(`/books/${bookRef}`);
  return { info: "📖 Ton livre est publié ! Il rejoint la bibliothèque de Co-Aut." };
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

  revalidatePath(`/books/${bookRef}`);
}
