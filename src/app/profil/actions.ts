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
