"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { classIsOpen, normalizeCode } from "@/lib/classes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CodeState = { error?: string };

/** Tentatives ratées tolérées par adresse IP (une classe entière partage souvent la même). */
const MAX_FAILS_PER_IP = 30;
/** Garde-fou global contre un essai massif de codes depuis de nombreuses adresses. */
const MAX_FAILS_TOTAL = 300;
const WINDOW_MINUTES = 10;

async function clientIpHash() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "inconnue";
  return createHash("sha256").update(`coaut-classe:${ip}`).digest("hex");
}

/**
 * Connexion d'un élève par son code personnel. Le code est cherché côté serveur (clé service),
 * puis une session s'ouvre sur son compte technique par un lien magique généré et vérifié ici
 * même : aucun mail ne part, l'élève ne voit jamais l'adresse factice de son compte.
 */
export async function enterWithCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const key = normalizeCode(String(formData.get("code") ?? ""));
  if (key.length < 5) return { error: "Écris ton code en entier, par exemple LOUTRE-2510." };

  const admin = createAdminClient();
  if (!admin) return { error: "L'espace classe n'est pas disponible pour le moment." };

  const ipHash = await clientIpHash();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const [{ count: ipFails }, { count: allFails }] = await Promise.all([
    admin
      .from("class_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("success", false)
      .gte("created_at", since),
    admin
      .from("class_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", since),
  ]);
  if ((ipFails ?? 0) >= MAX_FAILS_PER_IP || (allFails ?? 0) >= MAX_FAILS_TOTAL) {
    return { error: "Trop d'essais. Attends quelques minutes, ou demande ton code à ton enseignant." };
  }

  const log = (success: boolean) =>
    admin.from("class_login_attempts").insert({ ip_hash: ipHash, success });
  // Ménage : on ne garde qu'un jour de tentatives.
  await admin
    .from("class_login_attempts")
    .delete()
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString());

  const { data: student } = await admin
    .from("class_students")
    .select("class_id, author_id, authors(user_id)")
    .eq("code_key", key)
    .eq("active", true)
    .maybeSingle();
  const userId = (student?.authors as unknown as { user_id: string | null } | null)?.user_id;
  if (!student || !userId) {
    await log(false);
    return { error: "Ce code ne marche pas. Vérifie les lettres et les chiffres." };
  }

  if (!(await classIsOpen(admin, student.class_id))) {
    await log(true);
    return { error: "Ton livre est terminé. Bravo ! Ton enseignant te donnera un code pour le prochain." };
  }

  const { data: account } = await admin.auth.admin.getUserById(userId);
  const email = account?.user?.email;
  if (!email) return { error: "Ton compte n'est pas prêt. Demande à ton enseignant un nouveau code." };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("Connexion élève :", linkError?.message);
    return { error: "Connexion impossible pour le moment. Réessaie dans un instant." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error) {
    console.error("Connexion élève :", error.message);
    return { error: "Connexion impossible pour le moment. Réessaie dans un instant." };
  }
  await log(true);
  redirect("/classe/livres");
}

export async function leaveClass() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/classe");
}
