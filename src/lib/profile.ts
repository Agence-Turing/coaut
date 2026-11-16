import type { SupabaseClient } from "@supabase/supabase-js";

/** Âge minimal et maximal acceptés à la saisie d'une date de naissance. */
const MIN_AGE = 5;
const MAX_AGE = 110;

/** Âge en années révolues à la date `today` (date de naissance au format AAAA-MM-JJ). */
export function ageFrom(birthDate: string, today: Date = new Date()): number {
  const [y, m, d] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Vérifie une date de naissance saisie. Renvoie la date normalisée ou un message d'erreur. */
export function parseBirthDate(
  raw: string
): { date: string } | { error: string } {
  const value = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { error: "Indique ta date de naissance." };
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    return { error: "Cette date de naissance n'existe pas." };
  }
  const age = ageFrom(value);
  if (age < 0) return { error: "Ta date de naissance ne peut pas être dans le futur." };
  if (age < MIN_AGE || age > MAX_AGE) {
    return { error: "Vérifie ta date de naissance, elle semble incorrecte." };
  }
  return { date: value };
}

/** Date de naissance du profil privé de l'auteur (null si inconnue). */
export async function getBirthDate(
  supabase: SupabaseClient,
  authorId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("author_profiles")
    .select("birth_date")
    .eq("author_id", authorId)
    .maybeSingle();
  return (data?.birth_date as string | null) ?? null;
}

/**
 * Enregistre la date de naissance dans le profil privé (créé au besoin).
 * La table n'est lisible et modifiable que par son auteur (RLS).
 */
export async function saveBirthDate(
  supabase: SupabaseClient,
  authorId: string,
  birthDate: string
): Promise<{ error?: string }> {
  const { data: updated, error: updateError } = await supabase
    .from("author_profiles")
    .update({ birth_date: birthDate })
    .eq("author_id", authorId)
    .select("author_id");
  if (updateError) return { error: updateError.message };
  if (updated && updated.length > 0) return {};

  const { error: insertError } = await supabase
    .from("author_profiles")
    .insert({ author_id: authorId, birth_date: birthDate });
  return insertError ? { error: insertError.message } : {};
}
