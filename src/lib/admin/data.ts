import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * Lectures des tableaux d'administration (vues admin_* de la migration 0010, clé service).
 * Tri, filtres et pagination se font en base : les tableaux tiennent sur des milliers de lignes.
 */

export const PAGE_SIZE = 50;

export type SearchParams = Record<string, string | string[] | undefined>;

/** Valeur simple d'un paramètre d'URL (la première si répété). */
export function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texte de recherche sans les caractères qui ont un sens dans les filtres PostgREST. */
function cleanSearch(q: string) {
  return q.replace(/[%*,()"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

type Sort = { column: string; ascending: boolean; key: string };

function sortFrom(
  sp: SearchParams,
  columns: Record<string, string>,
  fallback: { key: string; ascending: boolean }
): Sort {
  const key = param(sp, "tri");
  const order = param(sp, "ordre");
  if (key in columns) {
    return { key, column: columns[key], ascending: order !== "desc" };
  }
  return { key: fallback.key, column: columns[fallback.key], ascending: fallback.ascending };
}

function pageFrom(sp: SearchParams) {
  const n = Number(param(sp, "page"));
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export type Listing<T> = { rows: T[]; total: number; page: number; pages: number; sort: Sort };

/* ---------- Livres ---------- */

export type AdminBookRow = {
  id: string;
  legacy_code: string | null;
  title: string;
  synopsis: string | null;
  status: "launched" | "published" | "archived";
  max_players: number | null;
  created_at: string;
  launcher_id: string | null;
  launcher_nickname: string | null;
  players_count: number;
  turns_count: number;
  last_turn_at: string | null;
  last_activity_at: string;
  current_writer_id: string | null;
  current_writer_nickname: string | null;
  class_id: string | null;
  class_name: string | null;
  teacher_review: boolean;
  open_to_join: boolean;
  /** Début du tour en cours (migration 0017), null pour les livres jamais touchés depuis. */
  turn_started_at: string | null;
  /** En attente depuis : début du tour en cours, dernier tour terminé ou lancement (le plus récent). */
  waiting_since: string;
  /** Numéro du tour à écrire (brouillon ouvert, sinon dernier + 1). */
  current_turn_number: number;
  /** Brouillon du tour en cours commencé le (null = pas de brouillon). */
  draft_started_at: string | null;
};

export const BOOK_SORTS: Record<string, string> = {
  code: "legacy_code",
  titre: "title",
  statut: "status",
  lanceur: "launcher_nickname",
  coauteurs: "players_count",
  tours: "turns_count",
  dernier: "last_turn_at",
  tour: "current_writer_nickname",
  depuis: "last_activity_at",
};

export const INACTIVE_DAYS = 30;

export async function listAdminBooks(
  db: SupabaseClient,
  sp: SearchParams
): Promise<Listing<AdminBookRow & { players: string[] }>> {
  const sort = sortFrom(sp, BOOK_SORTS, { key: "depuis", ascending: false });
  const page = pageFrom(sp);
  let query = db.from("admin_books").select("*", { count: "exact" });

  const q = cleanSearch(param(sp, "q"));
  if (q) {
    query = query.or(
      `title.ilike."*${q}*",legacy_code.ilike."*${q}*",launcher_nickname.ilike."*${q}*"`
    );
  }
  const statut = param(sp, "statut");
  if (["launched", "published", "archived"].includes(statut)) query = query.eq("status", statut);
  // « Lancé » = en cours avec une place libre (visible dans « Rejoindre un livre »),
  // « En cours d'écriture » = en cours, équipe au complet ou livre de classe.
  if (statut === "lance") query = query.eq("status", "launched").eq("open_to_join", true);
  if (statut === "ecriture") query = query.eq("status", "launched").eq("open_to_join", false);
  const visibilite = param(sp, "visibilite");
  if (visibilite === "public") query = query.is("class_id", null);
  if (visibilite === "classe") query = query.not("class_id", "is", null);
  const classe = param(sp, "classe");
  if (UUID_RE.test(classe)) query = query.eq("class_id", classe);
  if (param(sp, "inactif") === "1") {
    const limit = new Date(Date.now() - INACTIVE_DAYS * 86400_000).toISOString();
    query = query.eq("status", "launched").lt("last_activity_at", limit);
  }
  const auteur = param(sp, "auteur");
  if (UUID_RE.test(auteur)) {
    const { data } = await db.from("book_players").select("book_id").eq("author_id", auteur);
    const ids = (data ?? []).map((r) => r.book_id as string);
    query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  // Page au-delà de la fin (filtre resserré) : retour à la première page.
  if (error?.code === "PGRST103" && page > 1) return listAdminBooks(db, { ...sp, page: undefined });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AdminBookRow[];

  // Noms des co-auteurs des livres de la page, dans l'ordre de passage.
  const players = new Map<string, string[]>();
  if (rows.length) {
    const { data: team } = await db
      .from("book_players")
      .select("book_id, position, authors(nickname)")
      .in("book_id", rows.map((r) => r.id))
      .order("position");
    for (const p of (team ?? []) as unknown as {
      book_id: string;
      authors: { nickname: string } | null;
    }[]) {
      const list = players.get(p.book_id) ?? [];
      if (p.authors) list.push(p.authors.nickname);
      players.set(p.book_id, list);
    }
  }

  const total = count ?? 0;
  return {
    rows: rows.map((r) => ({ ...r, players: players.get(r.id) ?? [] })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort,
  };
}

/* ---------- Auteurs ---------- */

export type AdminAuthorRow = {
  id: string;
  nickname: string;
  user_id: string | null;
  deleted_at: string | null;
  kind: "adult" | "student";
  email: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  birth_date: string | null;
  city: string | null;
  country: string | null;
  is_professional: boolean;
  accepts_marketing: boolean;
  admin_note: string | null;
  blocked_at: string | null;
  is_blocked: boolean;
  last_turn_at: string | null;
  turns_count: number;
  books_count: number;
  is_admin: boolean;
};

export const AUTHOR_SORTS: Record<string, string> = {
  pseudo: "nickname",
  nom: "full_name",
  email: "email",
  age: "birth_date",
  ville: "city",
  pro: "is_professional",
  newsletter: "accepts_marketing",
  inscrit: "signed_up_at",
  dernier: "last_turn_at",
  bloque: "is_blocked",
};

export const AGE_RANGES: Record<string, { label: string; min?: number; max?: number }> = {
  "moins-12": { label: "Moins de 12 ans", max: 11 },
  "12-17": { label: "12 à 17 ans", min: 12, max: 17 },
  "18-plus": { label: "18 ans et plus", min: 18 },
  inconnu: { label: "Âge inconnu" },
};

/** Date de naissance limite (AAAA-MM-JJ) pour avoir `years` ans révolus aujourd'hui. */
function bornYearsAgo(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

/** Filtres de la liste des auteurs : partagés par le tableau et l'export CSV. */
function filterAuthors(db: SupabaseClient, sp: SearchParams, count: boolean) {
  let query = db.from("admin_authors").select("*", count ? { count: "exact" } : undefined);

  const q = cleanSearch(param(sp, "q"));
  if (q) {
    query = query.or(
      `nickname.ilike."*${q}*",full_name.ilike."*${q}*",email.ilike."*${q}*",city.ilike."*${q}*"`
    );
  }
  const age = AGE_RANGES[param(sp, "age")];
  if (age) {
    if (!age.min && !age.max) query = query.is("birth_date", null);
    // age >= min ⇔ né au plus tard il y a min ans ; age <= max ⇔ né après il y a (max+1) ans.
    if (age.min) query = query.lte("birth_date", bornYearsAgo(age.min));
    if (age.max !== undefined) query = query.gt("birth_date", bornYearsAgo(age.max + 1));
  }
  for (const [key, column] of [
    ["pro", "is_professional"],
    ["newsletter", "accepts_marketing"],
    ["bloque", "is_blocked"],
  ] as const) {
    const v = param(sp, key);
    if (v === "1") query = query.eq(column, true);
    if (v === "0") query = query.eq(column, false);
  }
  // Élèves (comptes techniques des classes) : à part, sur demande.
  const comptes = param(sp, "comptes");
  if (comptes === "eleves") query = query.eq("kind", "student");
  else if (comptes !== "tous") query = query.eq("kind", "adult");
  // Les auteurs supprimés (fiches anonymisées) ne sont montrés que sur demande.
  query =
    param(sp, "supprimes") === "1"
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
  return query;
}

export async function listAdminAuthors(
  db: SupabaseClient,
  sp: SearchParams
): Promise<Listing<AdminAuthorRow>> {
  const sort = sortFrom(sp, AUTHOR_SORTS, { key: "inscrit", ascending: false });
  const page = pageFrom(sp);
  const from = (page - 1) * PAGE_SIZE;
  // Trier par âge croissant = date de naissance décroissante.
  const ascending = sort.key === "age" ? !sort.ascending : sort.ascending;
  const { data, count, error } = await filterAuthors(db, sp, true)
    .order(sort.column, { ascending, nullsFirst: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  // Page au-delà de la fin (filtre resserré) : retour à la première page.
  if (error?.code === "PGRST103" && page > 1) return listAdminAuthors(db, { ...sp, page: undefined });
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as AdminAuthorRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort,
  };
}

/** Tous les auteurs filtrés (export CSV), par paquets de 1 000 (limite de PostgREST). */
export async function exportAdminAuthors(db: SupabaseClient, sp: SearchParams) {
  const rows: AdminAuthorRow[] = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await filterAuthors(db, sp, false)
      .order("signed_up_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as AdminAuthorRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/* ---------- Tours ---------- */

export type AdminTurnRow = {
  id: string;
  book_id: string;
  legacy_code: string | null;
  book_title: string;
  book_status: string;
  number: number;
  author_id: string | null;
  author_nickname: string | null;
  created_at: string;
  is_ended: boolean;
  excerpt: string | null;
  content_length: number;
  moderation_status: "ok" | "blocked" | "review" | null;
  moderation_reason: string | null;
  moderated_at: string | null;
};

export const TURN_SORTS: Record<string, string> = {
  livre: "book_title",
  numero: "number",
  auteur: "author_nickname",
  date: "created_at",
  ia: "is_moderation_blocked",
};

const TURN_COLUMNS =
  "id, book_id, legacy_code, book_title, book_status, number, author_id, author_nickname, created_at, is_ended, excerpt, content_length, moderation_status, moderation_reason, moderated_at";

export async function listAdminTurns(
  db: SupabaseClient,
  sp: SearchParams
): Promise<Listing<AdminTurnRow>> {
  const sort = sortFrom(sp, TURN_SORTS, { key: "date", ascending: false });
  const page = pageFrom(sp);
  let query = db.from("admin_turns").select(TURN_COLUMNS, { count: "exact" });

  const livreId = param(sp, "livre_id");
  if (UUID_RE.test(livreId)) query = query.eq("book_id", livreId);
  const livre = cleanSearch(param(sp, "livre"));
  if (livre) query = query.or(`book_title.ilike."*${livre}*",legacy_code.ilike."*${livre}*"`);

  const auteurId = param(sp, "auteur_id");
  if (UUID_RE.test(auteurId)) query = query.eq("author_id", auteurId);
  const auteur = cleanSearch(param(sp, "auteur"));
  if (auteur) query = query.ilike("author_nickname", `*${auteur}*`);

  const q = cleanSearch(param(sp, "q"));
  if (q) query = query.ilike("content", `*${q}*`);

  const ia = param(sp, "ia");
  if (ia === "bloque") query = query.eq("moderation_status", "blocked");
  if (ia === "revoir") query = query.eq("moderation_status", "review");

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("number", { ascending: sort.key === "livre" ? true : sort.ascending })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  // Page au-delà de la fin (filtre resserré) : retour à la première page.
  if (error?.code === "PGRST103" && page > 1) return listAdminTurns(db, { ...sp, page: undefined });
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as AdminTurnRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort,
  };
}

/* ---------- Tours en retard ---------- */

/** Seuil par défaut du filtre « tours en retard » (réunion du 24/11). */
export const LATE_DAYS = 15;

/** Nombre de jours du filtre (?jours=), entre 1 et 365, 15 par défaut. */
export function lateDaysOf(sp: SearchParams) {
  const n = Number(param(sp, "jours"));
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : LATE_DAYS;
}

export const LATE_SORTS: Record<string, string> = {
  livre: "title",
  numero: "current_turn_number",
  auteur: "current_writer_nickname",
  date: "waiting_since",
};

/**
 * Tours qui n'avancent pas : livres en cours où quelqu'un a la main (pas en attente de l'équipe)
 * et dont le tour en cours n'a pas été terminé depuis au moins N jours (vue admin_books,
 * waiting_since). Pour repérer les tours à passer.
 */
export async function listLateTurns(
  db: SupabaseClient,
  sp: SearchParams
): Promise<Listing<AdminBookRow> & { days: number }> {
  const sort = sortFrom(sp, LATE_SORTS, { key: "date", ascending: true });
  const page = pageFrom(sp);
  const days = lateDaysOf(sp);
  const limit = new Date(Date.now() - days * 86400_000).toISOString();
  let query = db
    .from("admin_books")
    .select("*", { count: "exact" })
    .eq("status", "launched")
    .not("current_writer_id", "is", null)
    .lte("waiting_since", limit);

  const livreId = param(sp, "livre_id");
  if (UUID_RE.test(livreId)) query = query.eq("id", livreId);
  const livre = cleanSearch(param(sp, "livre"));
  if (livre) query = query.or(`title.ilike."*${livre}*",legacy_code.ilike."*${livre}*"`);
  const auteurId = param(sp, "auteur_id");
  if (UUID_RE.test(auteurId)) query = query.eq("current_writer_id", auteurId);
  const auteur = cleanSearch(param(sp, "auteur"));
  if (auteur) query = query.ilike("current_writer_nickname", `*${auteur}*`);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error?.code === "PGRST103" && page > 1) return listLateTurns(db, { ...sp, page: undefined });
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as AdminBookRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort,
    days,
  };
}

/* ---------- Classes ---------- */

export type AdminClassRow = {
  id: string;
  name: string;
  created_at: string;
  blocked_at: string | null;
  is_blocked: boolean;
  owner_id: string;
  owner_nickname: string;
  owner_email: string | null;
  owner_blocked: boolean;
  students_count: number;
  books_count: number;
  launched_count: number;
};

export const CLASS_SORTS: Record<string, string> = {
  classe: "name",
  prof: "owner_nickname",
  eleves: "students_count",
  livres: "books_count",
  creee: "created_at",
};

export async function listAdminClasses(
  db: SupabaseClient,
  sp: SearchParams
): Promise<Listing<AdminClassRow>> {
  const sort = sortFrom(sp, CLASS_SORTS, { key: "creee", ascending: false });
  const page = pageFrom(sp);
  let query = db.from("admin_classes").select("*", { count: "exact" });
  const q = cleanSearch(param(sp, "q"));
  if (q) {
    query = query.or(
      `name.ilike."*${q}*",owner_nickname.ilike."*${q}*",owner_email.ilike."*${q}*"`
    );
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("id")
    .range(from, from + PAGE_SIZE - 1);
  if (error?.code === "PGRST103" && page > 1) return listAdminClasses(db, { ...sp, page: undefined });
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as AdminClassRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    sort,
  };
}

/* ---------- Mise en forme ---------- */

const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function formatDate(iso: string | null | undefined) {
  return iso ? DATE_FR.format(new Date(iso)) : "";
}

export function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

export const STATUS_LABELS: Record<string, string> = {
  launched: "En cours",
  published: "Publié",
  archived: "Archivé",
};

/** Libellé du statut dans l'admin : « Lancé » si le livre recrute encore, sinon « En cours ». */
export function statusLabel(b: { status: string; open_to_join?: boolean | null }) {
  if (b.status === "launched") return b.open_to_join ? "Lancé" : "En cours d'écriture";
  return STATUS_LABELS[b.status] ?? b.status;
}

export function bookCode(b: { legacy_code: string | null; id: string }) {
  return b.legacy_code ? b.legacy_code.replace("#", "") : b.id;
}
