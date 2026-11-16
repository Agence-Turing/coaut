import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { smtpConfig } from "./config";
import type { MailContent } from "./templates";

export type MailKind =
  | "your_turn"
  | "turn_reminder_1"
  | "turn_reminder_2"
  | "join_request"
  | "join_accepted"
  | "join_rejected"
  | "book_published";

let transport: nodemailer.Transporter | null = null;

/**
 * Envoie un mail à un auteur et le trace dans mail_log. Ne lève jamais d'erreur.
 * Un seul envoi par (type, auteur, dedupeKey) : un deuxième appel ne fait rien.
 * L'adresse est lue dans auth.users au moment de l'envoi et ne sort pas d'ici.
 */
export async function sendToAuthor(opts: {
  kind: MailKind;
  authorId: string;
  bookId: string | null;
  turnNumber?: number;
  dedupeKey: string;
  content: MailContent;
}): Promise<"sent" | "failed" | "skipped" | "duplicate"> {
  try {
    const admin = createAdminClient();
    if (!admin) return "skipped";

    const { data: log, error: logError } = await admin
      .from("mail_log")
      .insert({
        kind: opts.kind,
        author_id: opts.authorId,
        book_id: opts.bookId,
        turn_number: opts.turnNumber ?? null,
        dedupe_key: opts.dedupeKey,
      })
      .select("id")
      .maybeSingle();
    if (logError?.code === "23505") return "duplicate";
    if (logError || !log) {
      console.error("mail_log :", logError?.message);
      return "failed";
    }

    const finish = async (status: "sent" | "failed" | "skipped", error?: string) => {
      await admin
        .from("mail_log")
        .update({
          status,
          error: error ?? null,
          sent_at: status === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", log.id);
      return status;
    };

    const smtp = smtpConfig();
    if (!smtp) return finish("skipped", "SMTP non configuré");

    const { data: author } = await admin
      .from("authors")
      .select("user_id")
      .eq("id", opts.authorId)
      .maybeSingle();
    if (!author?.user_id) return finish("skipped", "auteur sans compte");

    const { data: account } = await admin.auth.admin.getUserById(author.user_id);
    const email = account?.user?.email;
    if (!email) return finish("skipped", "compte sans adresse");

    transport ??= nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.auth,
    });
    try {
      await transport.sendMail({
        from: smtp.from,
        to: email,
        subject: opts.content.subject,
        html: opts.content.html,
        text: opts.content.text,
      });
      return finish("sent");
    } catch (e) {
      return finish("failed", e instanceof Error ? e.message : String(e));
    }
  } catch (e) {
    console.error("Envoi de mail :", e);
    return "failed";
  }
}
