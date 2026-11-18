import { parseBirthDate, saveProfile, type ProfileValues } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  nickname: string;
  /** null si la fiche auteur n'a pas pu être créée (policies RLS manquantes). */
  authorId: string | null;
  /** true si la date de naissance n'est pas renseignée (anciens comptes) : invitation à compléter le profil. */
  needsBirthDate: boolean;
  /** Élève d'une classe (compte technique, connecté par son code) : ne voit que sa classe. */
  isStudent?: boolean;
  /** Enseignant ou professionnel (case du profil) : menu « Mes classes ». */
  isProfessional?: boolean;
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
    .select("id, nickname, kind")
    .eq("user_id", user.id)
    .maybeSingle();
  if (author?.kind === "student") {
    return { nickname: author.nickname, authorId: author.id, needsBirthDate: false, isStudent: true };
  }
  // Date de naissance saisie à l'inscription : elle voyage dans les métadonnées du compte
  // tant que la fiche auteur n'existe pas (confirmation d'e-mail), puis va dans le profil privé.
  const signupBirthDate = parseBirthDate(
    String(user.user_metadata?.birth_date ?? "")
  );
  // Ce qui a été saisi à l'inscription, recopié une seule fois dans le profil (avec la date).
  const signupProfile = (date: string): ProfileValues =>
    user.user_metadata?.is_professional
      ? {
          birth_date: date,
          is_professional: true,
          organization: String(user.user_metadata?.organization ?? "").slice(0, 120) || null,
        }
      : { birth_date: date };

  if (author) {
    const { data: profile } = await supabase
      .from("author_profiles")
      .select("birth_date, is_professional")
      .eq("author_id", author.id)
      .maybeSingle();
    let birthDate = (profile?.birth_date as string | null) ?? null;
    let isProfessional = Boolean(profile?.is_professional);
    if (!birthDate && "date" in signupBirthDate) {
      const values = signupProfile(signupBirthDate.date);
      const { error } = await saveProfile(supabase, author.id, values);
      if (!error) {
        birthDate = signupBirthDate.date;
        isProfessional = isProfessional || Boolean(values.is_professional);
      }
    }
    return {
      nickname: author.nickname,
      authorId: author.id,
      needsBirthDate: !birthDate,
      isProfessional,
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
  let isProfessional = false;
  if (created && "date" in signupBirthDate) {
    const values = signupProfile(signupBirthDate.date);
    const { error } = await saveProfile(supabase, created.id, values);
    hasBirthDate = !error;
    isProfessional = !error && Boolean(values.is_professional);
  }

  return {
    nickname: created?.nickname ?? nickname,
    authorId: created?.id ?? null,
    needsBirthDate: !hasBirthDate,
    isProfessional,
  };
}
