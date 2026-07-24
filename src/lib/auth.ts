import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  nickname: string;
  /** null si la fiche auteur n'a pas pu être créée (policies RLS manquantes). */
  authorId: string | null;
};

/** Utilisateur connecté (ou null). Crée sa fiche auteur au premier passage si besoin. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: author } = await supabase
    .from("authors")
    .select("id, nickname")
    .eq("user_id", user.id)
    .maybeSingle();
  if (author) return { nickname: author.nickname, authorId: author.id };

  // Session active mais pas encore de fiche auteur : on tente de la créer.
  const nickname =
    (user.user_metadata?.nickname as string | undefined) ??
    user.email?.split("@")[0] ??
    "auteur";
  const { data: created } = await supabase
    .from("authors")
    .insert({ nickname, user_id: user.id })
    .select("id, nickname")
    .maybeSingle();

  return { nickname: created?.nickname ?? nickname, authorId: created?.id ?? null };
}
