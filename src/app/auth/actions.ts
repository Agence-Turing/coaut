"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string };

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    return {
      error:
        error.code === "invalid_credentials"
          ? "Email ou mot de passe incorrect."
          : error.code === "email_not_confirmed"
            ? "Confirme d'abord ton adresse email (regarde ta boîte mail)."
            : `Connexion impossible : ${error.message}`,
    };
  }
  redirect("/books");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (nickname.length < 3) {
    return { error: "Choisis un pseudonyme d'au moins 3 caractères." };
  }

  const supabase = await createClient();

  const { data: taken } = await supabase
    .from("authors")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (taken) {
    return { error: "Ce pseudonyme est déjà pris, choisis-en un autre." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname } },
  });
  if (error) {
    return {
      error:
        error.code === "user_already_exists"
          ? "Un compte existe déjà avec cet email."
          : error.code === "weak_password"
            ? "Mot de passe trop faible (6 caractères minimum)."
            : `Inscription impossible : ${error.message}`,
    };
  }

  // Session immédiate (confirmation email désactivée) : on crée la fiche auteur.
  if (data.session && data.user) {
    await supabase.from("authors").insert({
      nickname,
      user_id: data.user.id,
    });
    redirect("/books");
  }

  return {
    info: "Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
