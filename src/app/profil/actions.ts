"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseBirthDate, saveBirthDate } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { error?: string; info?: string };

export async function updateBirthDate(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user?.authorId) return { error: "Reconnecte-toi pour modifier ton profil." };

  const parsed = parseBirthDate(String(formData.get("birth_date") ?? ""));
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await saveBirthDate(supabase, user.authorId, parsed.date);
  if (error) return { error: `Enregistrement impossible : ${error}` };

  revalidatePath("/", "layout");
  return { info: "Ta date de naissance est enregistrée." };
}

/** Case « professionnel » et établissement : sans validation, le menu « Mes classes » apparaît aussitôt. */
export async function updateProfessional(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user?.authorId || user.isStudent) return { error: "Reconnecte-toi pour modifier ton profil." };

  const isProfessional = formData.get("is_professional") === "1";
  const organization = String(formData.get("organization") ?? "").trim().slice(0, 120) || null;
  if (isProfessional && !organization)
    return { error: "Indique ton établissement ou ta structure (école, cabinet, association…)." };

  const supabase = await createClient();
  const values = { is_professional: isProfessional, organization };
  const { data: updated, error } = await supabase
    .from("author_profiles")
    .update(values)
    .eq("author_id", user.authorId)
    .select("author_id");
  if (error) return { error: `Enregistrement impossible : ${error.message}` };
  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("author_profiles")
      .insert({ author_id: user.authorId, ...values });
    if (insertError) return { error: `Enregistrement impossible : ${insertError.message}` };
  }

  revalidatePath("/", "layout");
  return {
    info: isProfessional
      ? "C'est noté : « Mes classes » est dans le menu. Tu peux créer ta première classe."
      : "C'est noté.",
  };
}
