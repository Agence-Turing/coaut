import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { deName } from "@/lib/fr";
import { sendToAuthor } from "./send";
import { classDigestMail } from "./templates";

/*
 * Récapitulatif quotidien des profs (livres de classe) : qui a écrit, à qui c'est le tour,
 * quels tours attendent la relecture. Un seul mail par prof et par jour, et seulement s'il
 * s'est passé quelque chose : jamais un mail par action. Appelé par la tâche des relances.
 */

/** Heure de Paris à partir de laquelle le récap part (la tâche tourne toutes les heures jusqu'à 19 h). */
export const DIGEST_HOUR = 18;

const parisParts = (d: Date) => {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
};

type TurnRow = {
  book_id: string;
  number: number;
  author_id: string | null;
  content: string | null;
  is_ended: boolean;
  is_validated: boolean;
  created_at: string;
};

export async function sendClassDigests(now: Date = new Date(), opts: { force?: boolean } = {}) {
  const result = { profs: 0, sent: 0 };
  const paris = parisParts(now);
  if (!opts.force && paris.hour < DIGEST_HOUR) return { ...result, skipped: "avant 18 h" };
  const admin = createAdminClient();
  if (!admin) return { ...result, error: "clé service absente" };

  const { data: books, error } = await admin
    .from("books")
    .select("id, title, launcher_id, teacher_review, classes(name)")
    .not("class_id", "is", null)
    .eq("status", "launched");
  if (error) return { ...result, error: error.message };
  if (!books?.length) return result;

  const bookIds = books.map((b) => b.id);
  const [{ data: turnsData }, { data: playersData }] = await Promise.all([
    admin
      .from("turns")
      .select("book_id, number, author_id, content, is_ended, is_validated, created_at")
      .in("book_id", bookIds),
    admin.from("book_players").select("book_id, author_id, position").in("book_id", bookIds),
  ]);
  const turns = (turnsData ?? []) as TurnRow[];
  const players = playersData ?? [];

  const authorIds = new Set<string>();
  turns.forEach((t) => t.author_id && authorIds.add(t.author_id));
  players.forEach((p) => authorIds.add(p.author_id));
  const { data: authors } = await admin
    .from("authors")
    .select("id, nickname")
    .in("id", [...authorIds]);
  const name = (id: string | null) => authors?.find((a) => a.id === id)?.nickname ?? "un élève";

  const byProf = new Map<string, typeof books>();
  for (const b of books) {
    if (!b.launcher_id) continue;
    byProf.set(b.launcher_id, [...(byProf.get(b.launcher_id) ?? []), b]);
  }

  for (const [profId, profBooks] of byProf) {
    result.profs += 1;
    // Depuis le dernier récap envoyé à ce prof (au plus 24 h en arrière).
    const { data: last } = await admin
      .from("mail_log")
      .select("sent_at")
      .eq("kind", "class_digest")
      .eq("author_id", profId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const since = last?.sent_at && last.sent_at > dayAgo ? last.sent_at : dayAgo;

    const lines: string[] = [];
    let activity = false;
    for (const b of profBooks) {
      const bookTurns = turns.filter((t) => t.book_id === b.id);
      const team = players
        .filter((p) => p.book_id === b.id)
        .sort((x, y) => x.position - y.position);
      const className = (b.classes as unknown as { name: string } | null)?.name;
      const label = `« ${b.title} »${className ? ` (${className})` : ""}`;

      const written = bookTurns
        .filter((t) => t.is_ended && t.content && t.created_at > since)
        .sort((x, y) => x.number - y.number);
      const pending = b.teacher_review
        ? bookTurns.filter((t) => t.is_ended && t.content && !t.is_validated)
        : [];
      if (written.length === 0 && pending.length === 0) continue;
      activity = true;

      const parts: string[] = [];
      if (written.length > 0) {
        parts.push(
          `${written.map((t) => `${name(t.author_id)} a écrit le tour ${t.number}`).join(", ")}.`
        );
      }
      if (pending.length > 0) {
        parts.push(`Le tour ${deName(name(pending[0].author_id))} attend ta relecture.`);
      } else {
        const open = bookTurns.find((t) => !t.is_ended);
        const ended = bookTurns.filter((t) => t.is_ended).length;
        const next = open?.author_id ?? (team.length ? team[ended % team.length].author_id : null);
        if (next) parts.push(`C'est au tour ${deName(name(next))}.`);
      }
      lines.push(`${label} : ${parts.join(" ")}`);
    }
    if (!activity) continue;

    const status = await sendToAuthor({
      kind: "class_digest",
      authorId: profId,
      bookId: null,
      dedupeKey: paris.date,
      content: classDigestMail(lines),
    });
    if (status === "sent") result.sent += 1;
  }
  return result;
}
