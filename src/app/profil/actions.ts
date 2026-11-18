"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseBirthDate, parseProfessional, saveProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; info?: string };

/** Profil en un seul formulaire : date de naissance, case « professionnel » et établissement. */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user?.authorId || user.isStudent) return { error: "Reconnecte-toi pour modifier ton profil." };

  const birth = parseBirthDate(String(formData.get("birth_date") ?? ""));
  if ("error" in birth) return { error: birth.error };
  const pro = parseProfessional(formData);
  if ("error" in pro) return { error: pro.error };

  const supabase = await createClient();
  const { error } = await saveProfile(supabase, user.authorId, { birth_date: birth.date, ...pro });
  if (error) return { error: `Enregistrement impossible : ${error}` };

  revalidatePath("/", "layout");
  return {
    info:
      pro.is_professional && !user.isProfessional
        ? "C'est enregistré. « Mes classes » est dans le menu : tu peux créer ta première classe."
        : "C'est enregistré.",
  };
}
