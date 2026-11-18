import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminContext = {
  /** Client à clé service : toutes les lectures et écritures de l'administration. */
  db: SupabaseClient;
  userId: string;
  /** Fiche auteur de l'administrateur (pour « m'ajouter » à un livre), si elle existe. */
  authorId: string | null;
};

type AdminCheck =
  | { status: "anonymous" }
  | { status: "forbidden" }
  | ({ status: "ok" } & AdminContext);

/**
 * Le compte connecté est-il administrateur ? Vérifié côté serveur : session validée par GoTrue,
 * puis présence dans public.admins lue avec la clé service (table invisible par l'API publique).
 */
const checkAdmin = cache(async (): Promise<AdminCheck> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  const db = createAdminClient();
  if (!db) return { status: "forbidden" };
  const { data: row } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { status: "forbidden" };

  const { data: author } = await db
    .from("authors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return { status: "ok", db, userId: user.id, authorId: (author?.id as string) ?? null };
});

/** Pour les pages : non connecté → connexion ; connecté sans le rôle → 404 (la page n'existe pas pour lui). */
export async function requireAdminPage(): Promise<AdminContext> {
  const check = await checkAdmin();
  if (check.status === "anonymous") redirect("/?mode=login");
  if (check.status === "forbidden") notFound();
  return check;
}

/** Pour les actions serveur et routes : refus net sans le rôle. */
export async function requireAdminAction(): Promise<AdminContext> {
  const check = await checkAdmin();
  if (check.status !== "ok") throw new Error("Accès réservé aux administrateurs.");
  return check;
}
