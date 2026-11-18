"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminAction, type AdminContext } from "@/lib/admin/guard";
import { UUID_RE } from "@/lib/admin/data";
import { notifyBookPublished, notifyBookStarts, notifyYourTurn } from "@/lib/mail/notify";

/*
 * Actions de l'administration. Chacune vérifie d'abord le rôle (requireAdminAction, qui lève une
 * erreur sinon), puis écrit avec la clé service. Les opérations qui touchent à l'ordre de passage
 * passent par les fonctions SQL admin_* (migration 0010), atomiques, qui gardent « à qui le tour »
 * cohérent avec writingState(). Retour : redirection vers la page d'origine avec ?ok= ou ?erreur=.
 */

/* ---------- Outils ---------- */

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Page où revenir : uniquement une page de l'administration. */
function backOf(formData: FormData, key = "back"): string {
  const back = str(formData, key);
  if (back.startsWith("/admin") && !back.startsWith("//")) return back;
  return key === "back" ? "/admin" : backOf(formData);
}

function withParams(back: string, params: Record<string, string | number>) {
  const url = new URL(back, "http://x");
  for (const k of ["ok", "erreur", "n"]) url.searchParams.delete(k);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return `${url.pathname}${url.search}`;
}

function done(back: string, ok: string, n = 1): never {
  revalidatePath("/", "layout");
  redirect(withParams(back, n > 1 ? { ok, n } : { ok }));
}

function fail(back: string, erreur: string): never {
  redirect(withParams(back, { erreur }));
}

/** Ids cochés (ou id de la ligne), validés. */
function idsOf(formData: FormData): string[] {
  const ids = formData.getAll("ids").map(String);
  return [...new Set(ids.filter((id) => UUID_RE.test(id)))];
}

/** Bouton d'une ligne : name="do" value="<action>:<id>" ; bouton du lot : value="bulk" + select « bulk ». */
function commandOf(formData: FormData): { action: string; ids: string[] } {
  const raw = str(formData, "do");
  if (raw === "bulk") return { action: str(formData, "bulk"), ids: idsOf(formData) };
  const [action, id] = raw.split(":");
  return { action, ids: UUID_RE.test(id ?? "") ? [id] : [] };
}

async function currentWriter(db: SupabaseClient, bookId: string) {
  const { data } = await db.rpc("admin_current_writer", { p_book: bookId });
  return (data as string | null) ?? null;
}

/** Après un changement d'équipe : mail « à toi d'écrire » si l'auteur dont c'est le tour a changé. */
function notifyIfWriterChanged(bookId: string, before: string | null, afterId: string | null) {
  if (afterId && afterId !== before) after(() => notifyYourTurn(bookId));
}

/* ---------- Livres ---------- */

async function setStatus(
  ctx: AdminContext,
  ids: string[],
  status: "archived" | "launched" | "published"
) {
  const { db } = ctx;
  if (status === "published") {
    for (const id of ids) {
      // Comme la publication par le lanceur : le brouillon en cours est clos s'il a du texte,
      // supprimé sinon.
      const { data: open } = await db
        .from("turns")
        .select("id, content")
        .eq("book_id", id)
        .eq("is_ended", false);
      for (const t of open ?? []) {
        if (t.content && String(t.content).trim()) {
          await db.from("turns").update({ is_ended: true, is_validated: true }).eq("id", t.id);
        } else {
          await db.from("turns").delete().eq("id", t.id);
        }
      }
    }
    const { data: written } = await db
      .from("turns")
      .select("book_id")
      .in("book_id", ids)
      .eq("is_ended", true)
      .not("content", "is", null);
    const ok = new Set((written ?? []).map((r) => r.book_id as string));
    ids = ids.filter((id) => ok.has(id));
    if (ids.length === 0) return 0;
  }
  const { data: before } = await db.from("books").select("id, status").in("id", ids);
  const { error } = await db.from("books").update({ status }).in("id", ids);
  if (error) throw new Error(error.message);
  if (status === "published") {
    const publisher = ctx.authorId ?? undefined;
    for (const b of before ?? []) {
      if (b.status !== "published") after(() => notifyBookPublished(b.id as string, publisher));
    }
  }
  return ids.length;
}

/** Tableau des livres : actions d'une ligne ou du lot coché. */
export async function booksAction(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const { action, ids } = commandOf(formData);
  if (!action) fail(back, "action");
  if (ids.length === 0) fail(back, "selection");

  if (action === "archive") return done(back, "archive", await setStatus(ctx, ids, "archived"));
  if (action === "relance") return done(back, "relance", await setStatus(ctx, ids, "launched"));
  if (action === "publie") {
    const n = await setStatus(ctx, ids, "published");
    if (n === 0) fail(back, "publier_vide");
    return done(back, "publie", n);
  }
  if (action === "supprime") {
    const { error } = await ctx.db.from("books").delete().in("id", ids);
    if (error) fail(back, "technique");
    return done(backOf(formData, "back_after_delete"), "livre_supprime", ids.length);
  }
  if (action === "passe") return passTurnOf(ctx, ids[0], back);
  fail(back, "action");
}

async function passTurnOf(ctx: AdminContext, bookId: string, back: string): Promise<never> {
  const { data: book } = await ctx.db.from("books").select("status").eq("id", bookId).maybeSingle();
  if (!book) fail(back, "introuvable");
  if (book.status !== "launched") fail(back, "pas_en_cours");
  const { count } = await ctx.db
    .from("book_players")
    .select("*", { count: "exact", head: true })
    .eq("book_id", bookId);
  if ((count ?? 0) < 2) fail(back, "equipe_seule");
  const before = await currentWriter(ctx.db, bookId);
  const { data: next, error } = await ctx.db.rpc("admin_pass_turn", { p_book: bookId });
  if (error) fail(back, "technique");
  notifyIfWriterChanged(bookId, before, (next as string | null) ?? null);
  done(back, "tour_passe");
}

export async function updateBook(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const id = str(formData, "id");
  const title = str(formData, "title");
  const synopsis = str(formData, "synopsis");
  if (!UUID_RE.test(id)) fail(back, "introuvable");
  if (title.length < 3) fail(back, "titre");
  const { error } = await ctx.db
    .from("books")
    .update({ title, synopsis: synopsis || null })
    .eq("id", id);
  if (error) fail(back, "technique");
  done(back, "livre_modifie");
}

export async function setMaxPlayers(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const id = str(formData, "id");
  const max = Number(str(formData, "max_players"));
  if (!UUID_RE.test(id)) fail(back, "introuvable");
  const { count } = await ctx.db
    .from("book_players")
    .select("*", { count: "exact", head: true })
    .eq("book_id", id);
  if (!Number.isInteger(max) || max < 1 || max > 30 || max < (count ?? 0)) fail(back, "max_joueurs");
  const { error } = await ctx.db.from("books").update({ max_players: max }).eq("id", id);
  if (error) fail(back, "technique");
  done(back, "max_joueurs");
}

export async function removePlayer(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const bookId = str(formData, "book_id");
  const authorId = str(formData, "author_id");
  if (!UUID_RE.test(bookId) || !UUID_RE.test(authorId)) fail(back, "introuvable");
  const before = await currentWriter(ctx.db, bookId);
  const { error } = await ctx.db.rpc("admin_remove_player", {
    p_book: bookId,
    p_author: authorId,
  });
  if (error) fail(back, "introuvable");
  const { data: book } = await ctx.db.from("books").select("status").eq("id", bookId).maybeSingle();
  if (book?.status === "launched") {
    notifyIfWriterChanged(bookId, before, await currentWriter(ctx.db, bookId));
  }
  done(back, "coauteur_retire");
}

export async function addPlayer(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const bookId = str(formData, "book_id");
  if (!UUID_RE.test(bookId)) fail(back, "introuvable");

  let authorId: string | null = null;
  if (formData.get("me") === "1") {
    authorId = ctx.authorId;
    if (!authorId) fail(back, "pas_de_fiche");
  } else {
    const nickname = str(formData, "nickname");
    const { data } = await ctx.db
      .from("authors")
      .select("id")
      .eq("nickname", nickname)
      .eq("kind", "adult")
      .is("deleted_at", null)
      .maybeSingle();
    authorId = (data?.id as string | undefined) ?? null;
    if (!authorId) fail(back, "auteur_inconnu");
  }

  const { data: exists } = await ctx.db
    .from("book_players")
    .select("author_id")
    .eq("book_id", bookId)
    .eq("author_id", authorId)
    .maybeSingle();
  if (exists) fail(back, "deja_equipe");

  const before = await currentWriter(ctx.db, bookId);
  const { error } = await ctx.db.rpc("admin_add_player", { p_book: bookId, p_author: authorId });
  if (error) fail(back, "technique");
  const { data: book } = await ctx.db.from("books").select("status").eq("id", bookId).maybeSingle();
  if (book?.status === "launched") {
    after(() => notifyBookStarts(bookId));
    notifyIfWriterChanged(bookId, before, await currentWriter(ctx.db, bookId));
  }
  done(back, "coauteur_ajoute");
}

/* ---------- Auteurs ---------- */

type AuthorTarget = { id: string; user_id: string | null; deleted_at: string | null };

/** Garde-fous communs au blocage et à la suppression. Renvoie un code d'erreur ou null. */
async function protectedAuthor(ctx: AdminContext, a: AuthorTarget) {
  if (a.user_id === ctx.userId) return "soi_meme";
  if (a.deleted_at) return "supprime";
  if (a.user_id) {
    const { data } = await ctx.db.from("admins").select("user_id").eq("user_id", a.user_id).maybeSingle();
    if (data) return "admin";
  }
  return null;
}

async function loadAuthors(ctx: AdminContext, ids: string[]) {
  const { data } = await ctx.db.from("authors").select("id, user_id, deleted_at").in("id", ids);
  return (data ?? []) as AuthorTarget[];
}

async function blockAuthors(ctx: AdminContext, authors: AuthorTarget[], block: boolean) {
  for (const a of authors) {
    const { error } = await ctx.db
      .from("author_profiles")
      .upsert(
        { author_id: a.id, blocked_at: block ? new Date().toISOString() : null },
        { onConflict: "author_id" }
      );
    if (error) throw new Error(error.message);
    if (a.user_id) {
      // Ban GoTrue : plus de connexion ni de renouvellement de session ; les sessions ouvertes
      // sont coupées. Les politiques « compte bloqué » refusent toute écriture en attendant.
      const { error: banError } = await ctx.db.auth.admin.updateUserById(a.user_id, {
        ban_duration: block ? "876000h" : "none",
      });
      if (banError) throw new Error(banError.message);
      if (block) await ctx.db.rpc("admin_revoke_sessions", { p_user: a.user_id });
    }
  }
}

/**
 * Suppression : le compte de connexion est effacé (e-mail compris), la fiche auteur est
 * anonymisée et ses tours restent dans les livres (admin_delete_author).
 */
async function deleteAuthors(ctx: AdminContext, authors: AuthorTarget[]) {
  for (const a of authors) {
    const { data: memberships } = await ctx.db
      .from("book_players")
      .select("book_id")
      .eq("author_id", a.id);
    const bookIds = (memberships ?? []).map((m) => m.book_id as string);
    const { data: teams } = bookIds.length
      ? await ctx.db
          .from("admin_books")
          .select("id, current_writer_id")
          .eq("status", "launched")
          .in("id", bookIds)
      : { data: [] };
    if (a.user_id) {
      const { error } = await ctx.db.auth.admin.deleteUser(a.user_id);
      if (error) throw new Error(error.message);
    }
    const { error } = await ctx.db.rpc("admin_delete_author", { p_author: a.id });
    if (error) throw new Error(error.message);
    for (const b of (teams ?? []) as { id: string; current_writer_id: string | null }[]) {
      notifyIfWriterChanged(b.id, b.current_writer_id, await currentWriter(ctx.db, b.id));
    }
  }
}

/** Tableau des auteurs : actions d'une ligne ou du lot coché. */
export async function authorsAction(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const { action, ids } = commandOf(formData);
  if (!action) fail(back, "action");
  if (ids.length === 0) fail(back, "selection");
  const authors = await loadAuthors(ctx, ids);
  if (authors.length === 0) fail(back, "introuvable");

  if (!["bloque", "debloque", "supprime"].includes(action)) fail(back, "action");
  for (const a of authors) {
    const problem = await protectedAuthor(ctx, a);
    if (problem && !(action === "debloque" && problem !== "supprime")) fail(back, problem);
  }

  try {
    if (action === "bloque") await blockAuthors(ctx, authors, true);
    if (action === "debloque") await blockAuthors(ctx, authors, false);
    if (action === "supprime") await deleteAuthors(ctx, authors);
  } catch (e) {
    console.error("authorsAction :", e);
    fail(back, "technique");
  }

  if (action === "supprime") {
    done(backOf(formData, "back_after_delete"), "auteur_supprime", authors.length);
  }
  done(back, action === "bloque" ? "bloque" : "debloque", authors.length);
}

export async function renameAuthor(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const id = str(formData, "id");
  const nickname = str(formData, "nickname");
  if (!UUID_RE.test(id)) fail(back, "introuvable");
  if (nickname.length < 3 || nickname.length > 40) fail(back, "pseudo_court");
  const { error } = await ctx.db.from("authors").update({ nickname }).eq("id", id).is("deleted_at", null);
  if (error) fail(back, error.code === "23505" ? "pseudo_pris" : "technique");
  done(back, "pseudo");
}

export async function saveAdminNote(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const id = str(formData, "id");
  const note = str(formData, "admin_note").slice(0, 4000);
  if (!UUID_RE.test(id)) fail(back, "introuvable");
  const { error } = await ctx.db
    .from("author_profiles")
    .upsert({ author_id: id, admin_note: note || null }, { onConflict: "author_id" });
  if (error) fail(back, "technique");
  done(back, "note");
}

/* ---------- Tours ---------- */

/** Tableau des tours : suppression d'une ligne ou du lot coché. */
export async function turnsAction(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const { action, ids } = commandOf(formData);
  if (action !== "supprime") fail(back, "action");
  if (ids.length === 0) fail(back, "selection");

  let n = 0;
  for (const id of ids) {
    const { error } = await ctx.db.rpc("admin_delete_turn", { p_turn: id });
    if (!error) n += 1;
  }
  if (n === 0) fail(back, "introuvable");
  done(backOf(formData, "back_after_delete"), "tour_supprime", n);
}

export async function updateTurn(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const id = str(formData, "id");
  const content = String(formData.get("content") ?? "").trim();
  if (!UUID_RE.test(id)) fail(back, "introuvable");
  if (!content) fail(back, "texte_vide");
  const { error } = await ctx.db.from("turns").update({ content }).eq("id", id);
  if (error) fail(back, "technique");
  done(back, "tour_modifie");
}

/* ---------- Classes ---------- */

async function classStudents(ctx: AdminContext, classIds: string[]) {
  const { data } = await ctx.db
    .from("class_students")
    .select("author_id, authors(id, user_id, deleted_at)")
    .in("class_id", classIds);
  return ((data ?? []) as unknown as { authors: AuthorTarget | null }[])
    .map((s) => s.authors)
    .filter((a): a is AuthorTarget => Boolean(a));
}

/**
 * Tableau des classes : bloquer ou débloquer la classe (tous ses élèves), bloquer ou débloquer
 * le prof, supprimer la classe (admin_delete_class : livres publiés gardés, autres supprimés).
 */
export async function classesAction(formData: FormData) {
  const ctx = await requireAdminAction();
  const back = backOf(formData);
  const { action, ids } = commandOf(formData);
  if (!action) fail(back, "action");
  if (ids.length === 0) fail(back, "selection");
  const { data: classes } = await ctx.db.from("classes").select("id, owner_id").in("id", ids);
  if (!classes?.length) fail(back, "introuvable");
  const classIds = classes.map((c) => c.id as string);

  if (action === "bloque_prof" || action === "debloque_prof") {
    const owners = await loadAuthors(ctx, [...new Set(classes.map((c) => c.owner_id as string))]);
    for (const o of owners) {
      const problem = await protectedAuthor(ctx, o);
      if (problem) fail(back, problem);
    }
    try {
      await blockAuthors(ctx, owners, action === "bloque_prof");
    } catch (e) {
      console.error("classesAction :", e);
      fail(back, "technique");
    }
    done(back, action === "bloque_prof" ? "bloque" : "debloque", owners.length);
  }

  if (action === "bloque" || action === "debloque") {
    const block = action === "bloque";
    try {
      await ctx.db
        .from("classes")
        .update({ blocked_at: block ? new Date().toISOString() : null })
        .in("id", classIds);
      await blockAuthors(ctx, await classStudents(ctx, classIds), block);
    } catch (e) {
      console.error("classesAction :", e);
      fail(back, "technique");
    }
    done(back, block ? "classe_bloquee" : "classe_debloquee", classIds.length);
  }

  if (action === "supprime") {
    try {
      for (const s of await classStudents(ctx, classIds)) {
        if (s.user_id) {
          const { error } = await ctx.db.auth.admin.deleteUser(s.user_id);
          if (error) throw new Error(error.message);
        }
      }
      for (const id of classIds) {
        const { error } = await ctx.db.rpc("admin_delete_class", { p_class: id });
        if (error) throw new Error(error.message);
      }
    } catch (e) {
      console.error("classesAction :", e);
      fail(back, "technique");
    }
    done(backOf(formData, "back_after_delete"), "classe_supprimee", classIds.length);
  }

  fail(back, "action");
}
