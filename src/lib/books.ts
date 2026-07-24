import { createClient } from "@/lib/supabase/server";

export type BookSummary = {
  id: string;
  legacy_code: string | null;
  title: string;
  synopsis: string | null;
  themes: string[];
  scolar_level: string | null;
  status: "launched" | "published";
  book_players: { position: number; authors: { nickname: string } | null }[];
  turns: { count: number }[];
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
  book_players(position, authors(nickname)), turns(count)`;

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

export async function getBook(code: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(`${BOOK_SUMMARY}, launcher:authors!books_launcher_id_fkey(nickname)`)
    .eq("legacy_code", `#${code}`)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as BookDetail | null;
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
