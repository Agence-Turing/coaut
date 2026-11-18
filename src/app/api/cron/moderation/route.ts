import { timingSafeEqual } from "node:crypto";
import { recheckPending } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/**
 * Relecture par l'IA des textes publiés sans lecture (IA en panne au moment de l'envoi),
 * appelée par une tâche planifiée :
 *   GET /api/cron/moderation   avec l'en-tête  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET absent" }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }
  return Response.json(await recheckPending());
}
