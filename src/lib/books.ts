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
  author_id: string | null;
  authors: { nickname: string } | null;
};

const BOOK_SUMMARY = `id, legacy_code, title, synopsis, themes, scolar_level, status,
  launcher_id, max_players,
  book_players(position, author_id, authors(nickname)), turns(count)`;

export type BookFilters = {
  q?: string;
  theme?: string;
  niveau?: string;
};

export async function listBooks(
  status: "launched" | "published",
  filters: BookFilters = {}
) {
  const supabase = await createClient();
  let query = supabase
    .from("books")
    .select(BOOK_SUMMARY)
    .eq("status", status)
    .order("legacy_code", { ascending: true });

  if (filters.q) {
    const q = filters.q.replaceAll("%", "").replaceAll(",", " ");
    query = query.or(`title.ilike.%${q}%,synopsis.ilike.%${q}%`);
  }
  if (filters.theme) query = query.contains("themes", [filters.theme]);
  if (filters.niveau) query = query.eq("scolar_level", filters.niveau);

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as BookSummary[]).filter(
    (b) => b.legacy_code !== "#000" // livre "exemple" de l'ancien MVP
  );
}

/**
 * Nombre de favoris par livre. Tolérant : renvoie une map vide tant que la
 * table favorites n'existe pas (migration 0005 non exécutée).
 */
export async function getFavoriteCounts(bookIds: string[]) {
  const map = new Map<string, number>();
  if (bookIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("book_id")
    .in("book_id", bookIds);
  if (error) return map;
  for (const row of data ?? []) {
    const id = row.book_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

/** Ids des livres mis en favori par l'auteur. */
export async function getMyFavoriteIds(authorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("author_id", authorId);
  if (error) return new Set<string>();
  return new Set((data ?? []).map((r) => r.book_id as string));
}

/** Livres publiés mis en favori par l'auteur. */
export async function listMyFavorites(authorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(`${BOOK_SUMMARY}, fav:favorites!inner(author_id)`)
    .eq("fav.author_id", authorId)
    .order("title", { ascending: true });
  if (error) return [];
  return data as unknown as BookSummary[];
}

/** Thèmes et niveaux distincts d'un statut, pour alimenter les filtres. */
export async function getFilterOptions(status: "launched" | "published") {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select("themes, scolar_level")
    .eq("status", status);
  if (error) throw error;

  const themes = new Set<string>();
  const levels = new Set<string>();
  for (const row of data ?? []) {
    (row.themes as string[]).forEach((t) => themes.add(t));
    if (row.scolar_level) levels.add(row.scolar_level as string);
  }
  const sortFr = (a: string, b: string) =>
    a.localeCompare(b, "fr", { sensitivity: "base" });
  return {
    themes: [...themes].sort(sortFr),
    levels: [...levels].sort(sortFr),
  };
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
    .select("id, number, content, is_ended, author_id, authors(nickname)")
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

/** À qui le tour, pour chaque livre donné : bookId → authorId. */
export async function getCurrentWriters(books: BookSummary[]) {
  const map = new Map<string, string | null>();
  if (books.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turns")
    .select("book_id, number, is_ended, author_id")
    .in(
      "book_id",
      books.map((b) => b.id)
    );
  if (error) throw error;

  for (const book of books) {
    const turns = (data ?? []).filter((t) => t.book_id === book.id);
    const open = turns.find((t) => !t.is_ended);
    if (open) {
      map.set(book.id, open.author_id as string | null);
      continue;
    }
    const players = book.book_players
      .slice()
      .sort((a, b) => a.position - b.position);
    if (players.length === 0) {
      map.set(book.id, null);
      continue;
    }
    const ended = turns.filter((t) => t.is_ended).length;
    map.set(book.id, players[ended % players.length].author_id);
  }
  return map;
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

export type WritingState = {
  /** Tour ouvert (brouillon en cours) s'il existe. */
  openTurn: Turn | null;
  /** Auteur dont c'est le tour (null si l'équipe est vide ou tour hérité orphelin). */
  currentAuthorId: string | null;
  currentNickname: string | null;
  /** Numéro du tour à écrire. */
  number: number;
};

/**
 * À qui le tour ? S'il y a un tour ouvert, c'est le sien ; sinon la rotation
 * suit l'ordre d'arrivée dans l'équipe (position), en repartant du lanceur.
 */
export function writingState(book: BookSummary, turns: Turn[]): WritingState {
  const players = book.book_players
    .slice()
    .sort((a, b) => a.position - b.position);
  const ended = turns.filter((t) => t.is_ended);
  const openTurn = turns.find((t) => !t.is_ended) ?? null;
  const maxNumber = turns.reduce((m, t) => Math.max(m, t.number), 0);

  if (openTurn) {
    const player = players.find((p) => p.author_id === openTurn.author_id);
    return {
      openTurn,
      currentAuthorId: openTurn.author_id,
      currentNickname:
        player?.authors?.nickname ?? openTurn.authors?.nickname ?? null,
      number: openTurn.number,
    };
  }

  if (players.length === 0) {
    return { openTurn: null, currentAuthorId: null, currentNickname: null, number: maxNumber + 1 };
  }

  const next = players[ended.length % players.length];
  return {
    openTurn: null,
    currentAuthorId: next.author_id,
    currentNickname: next.authors?.nickname ?? null,
    number: maxNumber + 1,
  };
}
