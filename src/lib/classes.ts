import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/*
 * Classes et élèves (docs/livres-prives-eleves.md).
 * Un élève = un compte technique (e-mail factice non routable, jamais affiché ni utilisé pour écrire),
 * une fiche auteur kind = 'student' (pseudonyme = prénom) et une ligne class_students qui porte son code.
 * Les codes ne s'écrivent qu'ici, avec la clé service : jamais par l'API publique.
 */

/** Mots simples, sans accent, faciles à recopier pour un enfant. */
const WORDS = [
  "ABEILLE", "AIGLE", "ANANAS", "ARBRE", "BALEINE", "BALLON", "BANANE", "BATEAU", "BISON", "BOUGIE",
  "BOUSSOLE", "CACTUS", "CAMION", "CANARD", "CARTABLE", "CASTOR", "CERISE", "CHAMEAU", "CHATEAU", "CHEVAL",
  "CITRON", "COCHON", "COLIBRI", "COMETE", "CORSAIRE", "CRABE", "CRAYON", "DAUPHIN", "DRAGON", "ECUREUIL",
  "ETOILE", "FALAISE", "FLAMANT", "FLEUR", "FORET", "FOURMI", "FUSEE", "GALAXIE", "GIRAFE", "GORILLE",
  "GRENOUILLE", "GUITARE", "HERISSON", "HIBOU", "IGLOO", "JAGUAR", "JARDIN", "KANGOUROU", "KOALA", "LAPIN",
  "LICORNE", "LION", "LOUTRE", "LUCIOLE", "LUTIN", "MAMMOUTH", "MANGUE", "MARMOTTE", "METEORE", "MOUETTE",
  "MOUTON", "NUAGE", "OCEAN", "OISEAU", "ORANGE", "OURAGAN", "PANDA", "PAPILLON", "PELICAN", "PENDULE",
  "PINGOUIN", "PIRATE", "PLANETE", "POISSON", "POMME", "PRAIRIE", "PIEUVRE", "RAQUETTE", "RENARD", "REQUIN",
  "RIVIERE", "ROBOT", "ROCHER", "SAPIN", "SARDINE", "SAUTERELLE", "SIRENE", "SOLEIL", "SOURIS", "TAMBOUR",
  "TIGRE", "TOMATE", "TORTUE", "TOUCAN", "TRESOR", "TROMPETTE", "TULIPE", "VAGUE", "VIOLON", "VOLCAN",
  "WAGON", "YAOURT", "ZEBRE", "CROCODILE", "HAMSTER", "LEZARD", "MANCHOT", "PAON", "PIVERT", "PHOQUE",
];

/** Domaine réservé (RFC 2606) : aucun mail ne peut y partir. */
const STUDENT_EMAIL_DOMAIN = "eleves.co-aut.invalid";

/** Nombre maximum d'élèves par classe (planche d'étiquettes, confort du prof). */
export const MAX_STUDENTS = 40;

export function newCode(): { code: string; key: string } {
  const word = WORDS[randomInt(WORDS.length)];
  const digits = String(randomInt(10_000)).padStart(4, "0");
  return { code: `${word}-${digits}`, key: `${word}${digits}` };
}

/** « loutre 2510 », « Loutre-2510 » → « LOUTRE2510 ». */
export function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Prénoms saisis un par ligne (ou séparés par des virgules), nettoyés et dédoublonnés. */
export function parseFirstNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) continue;
    const key = name.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Prénoms saisis plusieurs fois (casse ignorée), dans leur première forme : « Zoé, Noah, zoé » → ["Zoé"]. */
export function duplicateFirstNames(raw: string): string[] {
  const seen = new Map<string, string>();
  const dup = new Map<string, string>();
  for (const part of raw.split(/[\n,;]+/)) {
    const name = part.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) continue;
    const key = name.toLocaleLowerCase("fr");
    if (seen.has(key)) dup.set(key, seen.get(key)!);
    else seen.set(key, name);
  }
  return [...dup.values()];
}

export type ClassRow = { id: string; name: string; owner_id: string; created_at: string };

export type StudentRow = {
  id: string;
  author_id: string;
  first_name: string;
  position: number;
  code: string | null;
  active: boolean;
};

/** La classe, si elle appartient au prof connecté (sinon null). */
export async function getOwnedClass(classId: string, authorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("id, name, owner_id, created_at")
    .eq("id", classId)
    .maybeSingle();
  const cls = data as ClassRow | null;
  return cls && cls.owner_id === authorId ? cls : null;
}

export async function listOwnedClasses(authorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, name, owner_id, created_at")
    .eq("owner_id", authorId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return data as ClassRow[];
}

export async function listStudents(classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_students")
    .select("id, author_id, first_name, position, code, active")
    .eq("class_id", classId)
    .eq("active", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return [];
  return data as StudentRow[];
}

/** Tire un code libre et l'enregistre (clé service). Quelques essais en cas de collision. */
export async function assignNewCode(admin: SupabaseClient, studentId: string) {
  for (let i = 0; i < 8; i++) {
    const { code, key } = newCode();
    const { error } = await admin
      .from("class_students")
      .update({ code, code_key: key })
      .eq("id", studentId);
    if (!error) return code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Impossible de tirer un code libre.");
}

/**
 * Crée un élève : compte technique déjà confirmé (GoTrue n'envoie donc rien), fiche auteur
 * « student » à son prénom, ligne de classe avec son code.
 */
export async function createStudent(
  admin: SupabaseClient,
  classId: string,
  firstName: string,
  position: number
) {
  const { data: account, error: accountError } = await admin.auth.admin.createUser({
    email: `eleve-${randomUUID()}@${STUDENT_EMAIL_DOMAIN}`,
    email_confirm: true,
    app_metadata: { coaut_kind: "student" },
  });
  if (accountError || !account.user) {
    throw new Error(`compte élève : ${accountError?.message ?? "inconnu"}`);
  }
  const { data: author, error: authorError } = await admin
    .from("authors")
    .insert({ nickname: firstName, user_id: account.user.id, kind: "student" })
    .select("id")
    .single();
  if (authorError || !author) {
    await admin.auth.admin.deleteUser(account.user.id);
    throw new Error(`fiche élève : ${authorError?.message ?? "inconnue"}`);
  }
  const { data: student, error: studentError } = await admin
    .from("class_students")
    .insert({ class_id: classId, author_id: author.id, first_name: firstName, position })
    .select("id")
    .single();
  if (studentError || !student) {
    throw new Error(`élève : ${studentError?.message ?? "inconnu"}`);
  }
  await assignNewCode(admin, student.id);
  return { studentId: student.id as string, authorId: author.id as string };
}

/**
 * Le code d'un élève marche-t-il ? Oui tant que la classe a un livre en cours,
 * ou qu'elle n'a encore aucun livre ; non quand tous ses livres sont publiés ou archivés.
 */
export async function classIsOpen(admin: SupabaseClient, classId: string) {
  const { data } = await admin.from("books").select("status").eq("class_id", classId);
  const books = data ?? [];
  return books.length === 0 || books.some((b) => b.status === "launched");
}

export { STUDENT_EMAIL_DOMAIN };
