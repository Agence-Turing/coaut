import { timingSafeEqual } from "node:crypto";
import { sendTurnReminders } from "@/lib/mail/notify";
import { sendClassDigests } from "@/lib/mail/class-digest";

export const dynamic = "force-dynamic";

/**
 * Relances « à toi d'écrire », appelée par une tâche planifiée :
 *   GET /api/cron/relances   avec l'en-tête  Authorization: Bearer <CRON_SECRET>
 * Envoie aussi, à partir de 18 h, le récapitulatif quotidien des profs (livres de classe) ;
 * `?recap=maintenant` le force à toute heure (essais), toujours un seul par prof et par jour.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET absent" }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get("recap") === "maintenant";
  const reminders = await sendTurnReminders();
  const classDigests = await sendClassDigests(new Date(), { force });
  return Response.json({ ...reminders, classDigests });
}
