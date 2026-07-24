import { createClient } from "@/lib/supabase/server";

export type BookSummary = {
  id: string;
  legacy_code: string | null;
  title: string;
  synopsis: string | null;
  themes: string[];
  scolar_level: string | null;
  status: "launched" | "published";
  launcher_id: string | null;
  max_players: number | null;
  book_players: {
    position: number;
    author_id: string;
    authors: { nickname: string } | null;
  }[];
  turns: { count: number }[];
};

export type JoinRequest = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  message: string | null;
  created_at: string;
  author_id: string;
  authors: { nickname: string } | null;
};

export type BookDetail = BookSummary & {
  launcher: { nickname: string } | null;
};

export type Turn = {
  id: string;
  number: number;
  content: string | null;
  is_ended: boolean;
  authors: { nickname: string } | null;
};

const BOOK_SUMMARY = `id, legacy_code, title, synopsis, themes, scolar_level, status,
  launcher_id, max_players,
  book_players(position, author_id, authors(nickname)), turns(count)`;

export async function listBooks(status: "launched" | "published") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SUMMARY)
    .eq("status", status)
    .order("legacy_code", { ascending: true });
  if (error) throw error;
  return (data as unknown as BookSummary[]).filter(
    (b) => b.legacy_code !== "#000" // livre "exemple" de l'ancien MVP
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `ref` = code hérité sans le # ("052") ou id uuid (nouveaux livres). */
export async function getBook(ref: string) {
  const supabase = await createClient();
  const query = supabase
    .from("books")
    .select(`${BOOK_SUMMARY}, launcher:authors!books_launcher_id_fkey(nickname)`);
  const { data, error } = await (UUID_RE.test(ref)
    ? query.eq("id", ref)
    : query.eq("legacy_code", `#${ref}`)
  ).maybeSingle();
  if (error) throw error;
  return data as unknown as BookDetail | null;
}

export function bookRef(book: { id: string; legacy_code: string | null }) {
  return book.legacy_code ? book.legacy_code.replace("#", "") : book.id;
}

export async function getJoinRequests(bookId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("join_requests")
    .select("id, status, message, created_at, author_id, authors(nickname)")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as JoinRequest[];
}

export async function getMyJoinRequest(bookId: string, authorId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("join_requests")
    .select("id, status")
    .eq("book_id", bookId)
    .eq("author_id", authorId)
    .maybeSingle();
  return data as { id: string; status: JoinRequest["status"] } | null;
}

export async function getTurns(bookId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turns")
    .select("id, number, content, is_ended, authors(nickname)")
    .eq("book_id", bookId)
    .order("number", { ascending: true });
  if (error) throw error;
  return data as unknown as Turn[];
}

/** Livres dont l'auteur fait partie de l'équipe. */
export async function listMyBooks(authorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(`${BOOK_SUMMARY}, mine:book_players!inner(author_id)`)
    .eq("mine.author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as BookSummary[];
}

/** Demandes envoyées par l'auteur, avec le livre concerné. */
export async function listMyRequests(authorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("join_requests")
    .select(
      "id, status, created_at, books(id, legacy_code, title, status)"
    )
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as {
    id: string;
    status: JoinRequest["status"];
    created_at: string;
    books: Pick<BookSummary, "id" | "legacy_code" | "title" | "status"> | null;
  }[];
}

/** Tours en cours (non terminés) des livres donnés : bookId → authorId du tour. */
export async function getOpenTurns(bookIds: string[]) {
  if (bookIds.length === 0) return new Map<string, string | null>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turns")
    .select("book_id, author_id")
    .eq("is_ended", false)
    .in("book_id", bookIds);
  if (error) throw error;
  return new Map<string, string | null>(
    (data ?? []).map((t) => [t.book_id as string, t.author_id as string | null])
  );
}

export function playersOf(book: BookSummary) {
  return book.book_players
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((p) => p.authors?.nickname)
    .filter((n): n is string => Boolean(n));
}

export function turnsCountOf(book: BookSummary) {
  return book.turns[0]?.count ?? 0;
}
