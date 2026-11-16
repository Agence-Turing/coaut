import { timingSafeEqual } from "node:crypto";
import { sendTurnReminders } from "@/lib/mail/notify";

export const dynamic = "force-dynamic";

/**
 * Relances « à toi d'écrire », appelée par une tâche planifiée :
 *   GET /api/cron/relances   avec l'en-tête  Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET absent" }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }
  return Response.json(await sendTurnReminders());
}
