import type { NextRequest } from "next/server";
import { exportAdminAuthors, formatDate, type SearchParams } from "@/lib/admin/data";
import { requireAdminAction, type AdminContext } from "@/lib/admin/guard";
import { ageFrom } from "@/lib/profile";

/** Export CSV des auteurs, avec les filtres en cours du tableau (séparateur « ; », lisible par Excel). */
export async function GET(request: NextRequest) {
  let ctx: AdminContext;
  try {
    ctx = await requireAdminAction();
  } catch {
    return new Response("Accès réservé aux administrateurs.", { status: 403 });
  }

  const sp: SearchParams = Object.fromEntries(request.nextUrl.searchParams);
  const rows = await exportAdminAuthors(ctx.db, sp);

  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Guillemets doublés ; une cellule commençant par = + - @ est neutralisée (injection de formule).
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const yes = (b: boolean) => (b ? "oui" : "non");

  const header = [
    "Pseudo", "Prénom", "Nom", "E-mail", "Âge", "Date de naissance", "Ville", "Pays", "Pro",
    "Newsletter", "Inscrit le", "Dernier tour", "Tours écrits", "Livres", "Bloqué", "Note interne",
  ];
  const lines = rows.map((a) =>
    [
      a.nickname, a.first_name, a.last_name, a.email,
      a.birth_date ? ageFrom(a.birth_date) : "", a.birth_date, a.city, a.country,
      yes(a.is_professional), yes(a.accepts_marketing), formatDate(a.signed_up_at),
      formatDate(a.last_turn_at), a.turns_count, a.books_count, yes(a.is_blocked), a.admin_note,
    ]
      .map(cell)
      .join(";")
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...lines].join("\r\n") + "\r\n";
  const day = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auteurs-co-aut-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
