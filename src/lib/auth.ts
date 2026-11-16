import { getBirthDate, parseBirthDate, saveBirthDate } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  nickname: string;
  /** null si la fiche auteur n'a pas pu être créée (policies RLS manquantes). */
  authorId: string | null;
  /** true si la date de naissance n'est pas renseignée (anciens comptes) : invitation à compléter le profil. */
  needsBirthDate: boolean;
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
  // Date de naissance saisie à l'inscription : elle voyage dans les métadonnées du compte
  // tant que la fiche auteur n'existe pas (confirmation d'e-mail), puis va dans le profil privé.
  const signupBirthDate = parseBirthDate(
    String(user.user_metadata?.birth_date ?? "")
  );

  if (author) {
    let birthDate = await getBirthDate(supabase, author.id);
    if (!birthDate && "date" in signupBirthDate) {
      const { error } = await saveBirthDate(supabase, author.id, signupBirthDate.date);
      if (!error) birthDate = signupBirthDate.date;
    }
    return {
      nickname: author.nickname,
      authorId: author.id,
      needsBirthDate: !birthDate,
    };
  }

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

  let hasBirthDate = false;
  if (created && "date" in signupBirthDate) {
    const { error } = await saveBirthDate(supabase, created.id, signupBirthDate.date);
    hasBirthDate = !error;
  }

  return {
    nickname: created?.nickname ?? nickname,
    authorId: created?.id ?? null,
    needsBirthDate: !hasBirthDate,
  };
}
