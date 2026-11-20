import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getBook, getTurns, writingState } from "@/lib/books";

export const dynamic = "force-dynamic";

/** Au-delà, on refuse (un tour fait quelques milliers de caractères). */
const TAILLE_MAX = 50_000;

/**
 * Sauvegarde automatique du brouillon d'un tour, appelée par l'éditeur
 * (`TurnEditor`) quelques secondes après la frappe, à la perte du focus et à la
 * fermeture de l'onglet (fetch `keepalive`) :
 *   POST /api/brouillon   {"book_ref": "052", "content": "…"}
 * Mêmes garde-fous que « Terminer mon tour » (`saveTurn`) : seul l'auteur dont
 * c'est le tour écrit, rien tant que l'équipe n'est pas au complet ou qu'un tour
 * attend la relecture du prof. Le brouillon n'est ni modéré ni corrigé : il
 * n'est montré à personne. Il reste dans `turns` (is_ended = false) jusqu'à
 * l'envoi du tour.
 */
export async function POST(request: Request) {
  const corps = (await request.json().catch(() => null)) as {
    book_ref?: unknown;
    content?: unknown;
  } | null;
  const bookRef = typeof corps?.book_ref === "string" ? corps.book_ref : "";
  const content = typeof corps?.content === "string" ? corps.content.trim() : null;
  if (!bookRef || content === null || content.length > TAILLE_MAX)
    return Response.json({ error: "requête invalide" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "session" }, { status: 401 });
  if (!user.authorId) return Response.json({ error: "auteur" }, { status: 403 });

  const book = await getBook(bookRef);
  if (!book || book.status !== "launched")
    return Response.json({ error: "livre" }, { status: 409 });
  const turns = await getTurns(book.id);
  const state = writingState(book, turns);
  if (state.pendingReview || state.waitingForTeam || state.currentAuthorId !== user.authorId)
    return Response.json({ error: "pas ton tour" }, { status: 409 });

  const supabase = await createClient();
  if (state.openTurn) {
    const { error } = await supabase
      .from("turns")
      .update({ content })
      .eq("id", state.openTurn.id)
      .eq("is_ended", false);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else if (content) {
    // Pas de brouillon vide : le tour ne s'ouvre qu'au premier mot.
    const { error } = await supabase.from("turns").insert({
      content,
      is_ended: false,
      is_validated: false,
      book_id: book.id,
      number: state.number,
      author_id: user.authorId,
    });
    // 23505 : sauvegarde simultanée (deux onglets), la suivante mettra à jour.
    if (error && error.code !== "23505")
      return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, savedAt: new Date().toISOString() });
}
