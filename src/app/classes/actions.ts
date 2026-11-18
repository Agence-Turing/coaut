"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getBook, getTurns, writingState } from "@/lib/books";
import {
  MAX_STUDENTS,
  assignNewCode,
  createStudent,
  getOwnedClass,
  listStudents,
  parseFirstNames,
} from "@/lib/classes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ClassActionState = { error?: string; info?: string };

const NOT_PRO =
  "Les classes sont réservées aux enseignants et professionnels : coche la case dans « Mon profil ».";
const NO_ADMIN = "Le serveur n'est pas configuré pour créer des comptes d'élèves (clé service absente).";

/** Le prof connecté (professionnel, avec fiche auteur), sinon un message d'erreur. */
async function currentPro() {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId || user.isStudent) return { error: NOT_PRO } as const;
  if (!user.isProfessional) return { error: NOT_PRO } as const;
  return { user, authorId: user.authorId } as const;
}

/** Prénoms du formulaire : liste saisie, ou « Élève 1, 2… » si le prof donne un nombre. */
function namesFrom(formData: FormData, startAt = 1): string[] | { error: string } {
  const typed = parseFirstNames(String(formData.get("first_names") ?? ""));
  const count = Number(formData.get("count") ?? 0);
  if (typed.length > 0) return typed;
  if (Number.isInteger(count) && count > 0) {
    return Array.from({ length: Math.min(count, MAX_STUDENTS) }, (_, i) => `Élève ${startAt + i}`);
  }
  return { error: "Écris les prénoms des élèves (un par ligne), ou indique un nombre d'élèves." };
}

/** Ajoute les élèves aux livres en cours de la classe (en fin d'ordre de passage). */
async function addToOpenBooks(classId: string, authorIds: string[]) {
  const admin = createAdminClient();
  if (!admin || authorIds.length === 0) return;
  const { data: books } = await admin
    .from("books")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "launched");
  for (const book of books ?? []) {
    const { data: team } = await admin
      .from("book_players")
      .select("position")
      .eq("book_id", book.id);
    const start = (team ?? []).reduce((m, p) => Math.max(m, p.position + 1), 0);
    await admin.from("book_players").insert(
      authorIds.map((author_id, i) => ({ book_id: book.id, author_id, position: start + i }))
    );
  }
}

export async function createClass(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const pro = await currentPro();
  if ("error" in pro) return { error: pro.error };
  const admin = createAdminClient();
  if (!admin) return { error: NO_ADMIN };

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80)
    return { error: "Donne un nom à ta classe (2 à 80 caractères), par exemple « CM1 — École Jules Ferry »." };
  const names = namesFrom(formData);
  if ("error" in names) return names;
  if (names.length > MAX_STUDENTS)
    return { error: `${MAX_STUDENTS} élèves au plus par classe.` };

  const supabase = await createClient();
  const { data: cls, error } = await supabase
    .from("classes")
    .insert({ owner_id: pro.authorId, name })
    .select("id")
    .single();
  if (error || !cls) return { error: `Création impossible : ${error?.message ?? "erreur inconnue"}` };

  try {
    for (const [i, firstName] of names.entries()) {
      await createStudent(admin, cls.id, firstName, i);
    }
  } catch (e) {
    console.error("Création des élèves :", e);
    return { error: "La classe est créée mais certains élèves n'ont pas pu l'être. Ajoute-les depuis la page de la classe." };
  }

  revalidatePath("/classes");
  redirect(`/classes/${cls.id}`);
}

export async function addStudents(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const pro = await currentPro();
  if ("error" in pro) return { error: pro.error };
  const admin = createAdminClient();
  if (!admin) return { error: NO_ADMIN };

  const classId = String(formData.get("class_id") ?? "");
  const cls = await getOwnedClass(classId, pro.authorId);
  if (!cls) return { error: "Classe introuvable." };

  const current = await listStudents(classId);
  const names = namesFrom(formData, current.length + 1);
  if ("error" in names) return names;
  const taken = new Set(current.map((s) => s.first_name.toLocaleLowerCase("fr")));
  const fresh = names.filter((n) => !taken.has(n.toLocaleLowerCase("fr")));
  if (fresh.length === 0)
    return { error: "Ces prénoms sont déjà dans la classe. Ajoute une initiale pour les distinguer (« Léa B. »)." };
  if (current.length + fresh.length > MAX_STUDENTS)
    return { error: `${MAX_STUDENTS} élèves au plus par classe.` };

  const start = current.reduce((m, s) => Math.max(m, s.position + 1), 0);
  const created: string[] = [];
  try {
    for (const [i, firstName] of fresh.entries()) {
      const s = await createStudent(admin, classId, firstName, start + i);
      created.push(s.authorId);
    }
  } catch (e) {
    console.error("Ajout d'élèves :", e);
    return { error: "Certains élèves n'ont pas pu être ajoutés. Réessaie." };
  } finally {
    await addToOpenBooks(classId, created);
  }

  revalidatePath(`/classes/${classId}`);
  const skipped = names.length - fresh.length;
  return {
    info:
      `${fresh.length} élève${fresh.length > 1 ? "s" : ""} ajouté${fresh.length > 1 ? "s" : ""}, avec un code chacun.` +
      (skipped > 0 ? ` ${skipped} prénom${skipped > 1 ? "s" : ""} déjà dans la classe.` : ""),
  };
}

/** Vérifie que l'élève appartient à une classe du prof connecté. */
async function ownedStudent(studentId: string) {
  const pro = await currentPro();
  if ("error" in pro) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_students")
    .select("id, class_id, author_id, active, classes(owner_id)")
    .eq("id", studentId)
    .maybeSingle();
  const owner = (data?.classes as unknown as { owner_id: string } | null)?.owner_id;
  if (!data || owner !== pro.authorId) return null;
  return data as { id: string; class_id: string; author_id: string; active: boolean };
}

export async function regenerateCode(formData: FormData) {
  const student = await ownedStudent(String(formData.get("student_id") ?? ""));
  const admin = createAdminClient();
  if (!student || !student.active || !admin) return;
  await assignNewCode(admin, student.id);
  revalidatePath(`/classes/${student.class_id}`);
}

/**
 * Retire un élève : son code ne marche plus, il quitte l'équipe des livres en cours
 * (son tour ouvert éventuel est passé). Ses tours déjà écrits restent à son prénom.
 */
export async function removeStudent(formData: FormData) {
  const student = await ownedStudent(String(formData.get("student_id") ?? ""));
  const admin = createAdminClient();
  if (!student || !admin) return;

  await admin
    .from("class_students")
    .update({ active: false, code: null, code_key: null })
    .eq("id", student.id);

  const { data: books } = await admin
    .from("books")
    .select("id")
    .eq("class_id", student.class_id)
    .eq("status", "launched");
  for (const book of books ?? []) {
    await admin
      .from("turns")
      .update({ content: null, is_ended: true, is_validated: true })
      .eq("book_id", book.id)
      .eq("author_id", student.author_id)
      .eq("is_ended", false);
    await admin.from("book_players").delete().eq("book_id", book.id).eq("author_id", student.author_id);
  }
  revalidatePath(`/classes/${student.class_id}`);
}

/** « Lancer un livre » → Réservé à ma classe. Appelé par createBook (src/app/books/actions.ts). */
export async function createClassBook(
  _prev: ClassActionState,
  formData: FormData
): Promise<ClassActionState> {
  const pro = await currentPro();
  if ("error" in pro) return { error: pro.error };

  const classId = String(formData.get("class_id") ?? "");
  const cls = classId ? await getOwnedClass(classId, pro.authorId) : null;
  if (!cls) return { error: "Choisis la classe qui écrira ce livre." };

  const title = String(formData.get("title") ?? "").trim();
  const synopsis = String(formData.get("synopsis") ?? "").trim();
  const scolarLevel = String(formData.get("scolar_level") ?? "").trim();
  const themes = String(formData.get("themes") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (title.length < 3) return { error: "Donne un titre à l'histoire (3 caractères minimum)." };
  if (synopsis.length < 20)
    return { error: "Écris un résumé un peu plus complet (20 caractères minimum) : c'est le point de départ des élèves." };

  const students = await listStudents(classId);
  if (students.length === 0) return { error: "Cette classe n'a pas encore d'élèves." };
  const order = students.slice();
  if (formData.get("order") === "random") {
    for (let i = order.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  const supabase = await createClient();
  const { data: book, error } = await supabase
    .from("books")
    .insert({
      title,
      synopsis,
      themes,
      scolar_level: scolarLevel || null,
      status: "launched",
      launcher_id: pro.authorId,
      max_players: order.length,
      class_id: classId,
      teacher_review: formData.get("teacher_review") === "1",
    })
    .select("id")
    .single();
  if (error || !book) {
    return { error: `Impossible de lancer le livre : ${error?.message ?? "erreur inconnue"}` };
  }

  const { error: teamError } = await supabase
    .from("book_players")
    .insert(order.map((s, i) => ({ book_id: book.id, author_id: s.author_id, position: i })));
  if (teamError) console.error("Équipe du livre de classe :", teamError.message);

  revalidatePath(`/classes/${classId}`);
  redirect(`/books/${book.id}`);
}

/** Le livre de classe, si le prof connecté en est le lanceur et qu'il est en cours. */
async function ownedClassBook(bookRef: string) {
  const user = await getCurrentUser();
  if (!user?.authorId) return null;
  const book = await getBook(bookRef);
  if (!book || !book.class_id || book.launcher_id !== user.authorId) return null;
  if (book.status !== "launched") return null;
  return book;
}

/** Ordre de passage : monter ou descendre un élève d'un cran, ou tout mélanger. */
export async function reorderTeam(formData: FormData) {
  const bookRef = String(formData.get("book_ref") ?? "");
  const book = await ownedClassBook(bookRef);
  if (!book) return;

  const team = book.book_players.slice().sort((a, b) => a.position - b.position);
  const move = String(formData.get("move") ?? "");
  if (move === "shuffle") {
    for (let i = team.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [team[i], team[j]] = [team[j], team[i]];
    }
  } else {
    const i = team.findIndex((p) => p.author_id === formData.get("author_id"));
    const j = move === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= team.length) return;
    [team[i], team[j]] = [team[j], team[i]];
  }

  const supabase = await createClient();
  for (const [position, p] of team.entries()) {
    await supabase
      .from("book_players")
      .update({ position })
      .eq("book_id", book.id)
      .eq("author_id", p.author_id);
  }
  revalidatePath(`/books/${bookRef}`);
}

/** Passer le tour d'un absent : tour vide et clos, la plume passe au suivant. */
export async function skipTurn(formData: FormData) {
  const bookRef = String(formData.get("book_ref") ?? "");
  const book = await ownedClassBook(bookRef);
  if (!book) return;
  const turns = await getTurns(book.id);
  const state = writingState(book, turns);
  if (!state.currentAuthorId || state.pendingReview) return;

  const supabase = await createClient();
  if (state.openTurn) {
    await supabase
      .from("turns")
      .update({ content: null, is_ended: true, is_validated: true })
      .eq("id", state.openTurn.id);
  } else {
    await supabase.from("turns").insert({
      book_id: book.id,
      number: state.number,
      author_id: state.currentAuthorId,
      content: null,
      is_ended: true,
      is_validated: true,
    });
  }
  revalidatePath(`/books/${bookRef}`);
}

/** Relecture d'un tour : le valider (il rejoint le livre) ou le rendre à l'élève. */
export async function reviewTurn(formData: FormData) {
  const bookRef = String(formData.get("book_ref") ?? "");
  const book = await ownedClassBook(bookRef);
  if (!book || !book.teacher_review) return;
  const turnId = String(formData.get("turn_id") ?? "");
  const approve = formData.get("decision") === "approve";

  const supabase = await createClient();
  await supabase
    .from("turns")
    .update(approve ? { is_validated: true } : { is_ended: false, is_validated: false })
    .eq("id", turnId)
    .eq("book_id", book.id)
    .eq("is_ended", true)
    .eq("is_validated", false);
  revalidatePath(`/books/${bookRef}`);
}
