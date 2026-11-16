import "server-only";
import { siteUrl } from "./config";

export type MailContent = { subject: string; html: string; text: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Gabarit commun des mails Co-Aut (le même que public/emails/*.html, envoyés par GoTrue). */
function layout(opts: {
  subject: string;
  title: string;
  paragraphs: string[];
  cta: { label: string; path: string };
  footer?: string;
}): MailContent {
  const url = `${siteUrl()}${opts.cta.path}`;
  const footer =
    opts.footer ?? "Tu reçois ce message parce que tu participes à un livre sur Co-Aut.";
  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#F3F1EE;font-family:Inter,Arial,Helvetica,sans-serif;color:#1C1917;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EE;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8E6E3;">
            <tr>
              <td align="center" style="background:#1C1917;padding:22px;">
                <img src="${siteUrl()}/images/logo-co-aut.png" alt="Co-Aut" width="150" style="display:block;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;font-size:16px;line-height:1.5;">
                <p style="margin:0 0 16px;font-family:'Zilla Slab',Georgia,serif;font-size:26px;line-height:1.15;font-weight:bold;color:#1C1917;">${esc(opts.title)}</p>
                ${opts.paragraphs.map((p) => `<p style="margin:0 0 24px;">${esc(p)}</p>`).join("\n                ")}
                <p style="margin:0 0 24px;" align="center">
                  <a href="${url}" style="display:inline-block;background:#FF8A1E;color:#1C1917;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:10px;">${esc(opts.cta.label)}</a>
                </p>
                <p style="margin:0;font-size:14px;color:#57524D;">${esc(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [opts.title, "", ...opts.paragraphs, "", `${opts.cta.label} : ${url}`, "", footer].join("\n");
  return { subject: opts.subject, html, text };
}

type BookInfo = { title: string; path: string };

export function yourTurnMail(book: BookInfo, firstTurn: boolean): MailContent {
  return layout({
    subject: `À toi d'écrire : « ${book.title} »`,
    title: "C'est à ton tour d'écrire !",
    paragraphs: [
      firstTurn
        ? `Ton équipe est là : tu peux écrire le premier tour de « ${book.title} ».`
        : `Le tour précédent de « ${book.title} » est terminé. La suite de l'histoire t'attend.`,
    ],
    cta: { label: "Écrire mon tour", path: book.path },
  });
}

export function turnReminderMail(book: BookInfo, last: boolean): MailContent {
  return layout({
    subject: last
      ? `Dernier rappel : ton tour dans « ${book.title} »`
      : `Rappel : c'est à toi d'écrire dans « ${book.title} »`,
    title: last ? "Tes co-auteurs t'attendent toujours" : "Tes co-auteurs attendent ton tour",
    paragraphs: [
      `C'est toujours à toi d'écrire la suite de « ${book.title} ». Quelques phrases suffisent pour relancer l'histoire.`,
      ...(last ? ["C'est notre dernier rappel pour ce tour."] : []),
    ],
    cta: { label: "Écrire mon tour", path: book.path },
  });
}

export function joinRequestMail(book: BookInfo, nickname: string): MailContent {
  return layout({
    subject: `${nickname} veut rejoindre « ${book.title} »`,
    title: "Une nouvelle demande pour ton livre",
    paragraphs: [
      `${nickname} demande à rejoindre « ${book.title} ». Son message t'attend sur la page du livre : à toi d'accepter ou de refuser.`,
    ],
    cta: { label: "Voir la demande", path: book.path },
    footer: "Tu reçois ce message parce que tu as lancé ce livre sur Co-Aut.",
  });
}

export function joinAnswerMail(book: BookInfo, accepted: boolean): MailContent {
  return accepted
    ? layout({
        subject: `Tu fais partie de « ${book.title} » !`,
        title: "Ta demande est acceptée",
        paragraphs: [
          `Bienvenue dans l'équipe de « ${book.title} ». Tu recevras un mail quand ce sera à ton tour d'écrire.`,
        ],
        cta: { label: "Voir le livre", path: book.path },
        footer: "Tu reçois ce message parce que tu as demandé à rejoindre ce livre sur Co-Aut.",
      })
    : layout({
        subject: `Ta demande pour « ${book.title} »`,
        title: "Ta demande n'a pas été retenue",
        paragraphs: [
          `Le lanceur de « ${book.title} » n'a pas retenu ta demande cette fois-ci. D'autres histoires cherchent des co-auteurs.`,
        ],
        cta: { label: "Trouver un autre livre", path: "/books" },
        footer: "Tu reçois ce message parce que tu as demandé à rejoindre ce livre sur Co-Aut.",
      });
}

export function bookPublishedMail(book: BookInfo): MailContent {
  return layout({
    subject: `« ${book.title} » est publié !`,
    title: "Votre livre est publié",
    paragraphs: [
      `Bravo : « ${book.title} », que tu as écrit avec tes co-auteurs, vient de rejoindre la bibliothèque de Co-Aut.`,
    ],
    cta: { label: "Lire le livre", path: book.path },
  });
}
