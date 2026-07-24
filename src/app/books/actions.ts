"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

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
