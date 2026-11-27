"use server";

import { redirect } from "next/navigation";
import { parseBirthDate, parseProfessional, saveProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { findContact } from "@/lib/moderation/contacts";

export type AuthState = {
  error?: string;
  info?: string;
  /** Adresse en attente de confirmation : propose de renvoyer le mail. */
  pendingEmail?: string;
  /** Jeton du mail déjà échangé contre une session : le formulaire ne le renvoie plus. */
  tokenUsed?: boolean;
};

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: String(formData.get("password") ?? ""),
  });
  if (error) {
    return {
      pendingEmail: error.code === "email_not_confirmed" ? email : undefined,
      error:
        error.code === "invalid_credentials"
          ? "Email ou mot de passe incorrect. Co-Aut a une nouvelle version : si tu avais déjà un compte, clique sur « Mot de passe oublié » pour retrouver ton accès."
          : error.code === "email_not_confirmed"
            ? "Confirme d'abord ton adresse email : clique sur le lien reçu par mail."
            : error.code === "user_banned"
              ? "Ton compte est bloqué. Pour en savoir plus, écris à contact@co-aut.com."
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
  // Le pseudonyme est visible de tous : pas de coordonnées dedans (repérage par le code seul).
  if (findContact(nickname)) {
    return {
      error:
        "Ton pseudonyme ressemble à une coordonnée (e-mail, numéro, lien ou réseau social). Choisis-en un autre.",
    };
  }

  const birth = parseBirthDate(String(formData.get("birth_date") ?? ""));
  if ("error" in birth) return { error: birth.error };
  const pro = parseProfessional(formData);
  if ("error" in pro) return { error: pro.error };

  const supabase = await createClient();

  const { data: taken } = await supabase
    .from("authors")
    .select("id")
    .eq("nickname", nickname)
    .eq("kind", "adult") // les élèves s'affichent sous leur prénom, sans réserver de pseudonyme
    .maybeSingle();
  if (taken) {
    return { error: "Ce pseudonyme est déjà pris, choisis-en un autre." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname, birth_date: birth.date, ...pro } },
  });
  if (error) {
    return {
      error:
        error.code === "user_already_exists"
          ? "Un compte existe déjà avec cet email."
          : error.code === "weak_password"
            ? "Mot de passe trop faible (6 caractères minimum)."
            : error.code === "over_email_send_rate_limit"
              ? "Trop de demandes d'un coup. Attends une minute avant de réessayer."
              : error.code === "unexpected_failure"
                ? // La fiche auteur est créée avec le compte : le pseudonyme a pu être pris à l'instant.
                  "Inscription impossible : ce pseudonyme vient peut-être d'être pris. Essaie avec un autre."
                : `Inscription impossible : ${error.message}`,
    };
  }

  // La fiche auteur est créée en base avec le compte (trigger handle_new_user), ce qui réserve
  // le pseudonyme pendant la confirmation de l'adresse.
  // Session immédiate (confirmation email désactivée) : on entre directement.
  if (data.session && data.user) {
    const { data: existing } = await supabase
      .from("authors")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const { data: author } = existing
      ? { data: existing }
      : await supabase
          .from("authors")
          .insert({ nickname, user_id: data.user.id })
          .select("id")
          .maybeSingle();
    if (author) await saveProfile(supabase, author.id, { birth_date: birth.date, ...pro });
    redirect("/books");
  }

  return {
    info: `Presque fini ! Un mail vient de partir à ${email} : clique sur le lien pour confirmer ton adresse et entrer sur Co-Aut. Tu avais déjà un compte ? Utilise « Mot de passe oublié ».`,
    pendingEmail: email,
  };
}

export async function resendConfirmation(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Adresse manquante." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error?.code === "over_email_send_rate_limit") {
    return {
      error: "Un mail vient déjà de partir. Attends une minute avant de réessayer.",
      pendingEmail: email,
    };
  }
  if (error) console.error("Renvoi de confirmation :", error.code, error.message);
  return { info: "C'est reparti : regarde ta boîte mail (et tes indésirables).", pendingEmail: email };
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indique ton email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error?.code === "over_email_send_rate_limit") {
    return {
      error: "Un lien vient déjà d'être envoyé. Attends une minute avant de réessayer.",
    };
  }
  if (error) console.error("Mot de passe oublié :", error.code, error.message);

  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  return {
    info: "Si un compte existe avec cet email, un lien vient de partir. Regarde ta boîte mail (et tes indésirables). Si tu as demandé plusieurs liens, seul le dernier mail fonctionne.",
  };
}

const LIEN_PERIME =
  "Ce lien n'est plus valable : il a déjà servi, ou un mail plus récent l'a remplacé. Si tu as reçu plusieurs mails, ouvre le dernier arrivé, ou demande un nouveau lien depuis « Mot de passe oublié ».";

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 6) {
    return { error: "Mot de passe trop court (6 caractères minimum)." };
  }
  if (password !== confirmation) {
    return { error: "Les deux mots de passe ne sont pas identiques." };
  }

  const supabase = await createClient();
  // Arrivée par le lien du mail : le jeton n'est consommé qu'ici (voir /auth/confirm) et
  // ouvre la session. Si le changement échoue ensuite (ex. même mot de passe qu'avant), le
  // formulaire ne renvoie plus le jeton (tokenUsed) : le nouvel essai passe par la session.
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (verifyError) return { error: LIEN_PERIME };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      tokenUsed: Boolean(tokenHash) || formData.get("token_used") === "1",
      error:
        error.code === "same_password"
          ? "Choisis un mot de passe différent de l'ancien."
          : error.code === "weak_password"
            ? "Mot de passe trop faible (6 caractères minimum)."
            : `Changement impossible : ${error.message}`,
    };
  }
  redirect("/books");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
