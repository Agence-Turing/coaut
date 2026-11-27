import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Arrivée depuis un lien reçu par e-mail (mot de passe oublié, confirmation d'adresse).
 * Le lien porte un jeton à usage unique, échangé contre une session côté serveur
 * (l'API Supabase n'est pas exposée au navigateur).
 *
 * Mot de passe oublié : le jeton n'est PAS consommé ici, seulement à l'envoi du nouveau
 * mot de passe (`updatePassword`). Un lien ouvert deux fois, ou visité d'abord par l'antivirus
 * d'une messagerie, reste valable tant que le mot de passe n'a pas été changé
 * (retour du 27/11 : un premier clic sans aller au bout rendait le lien inutilisable).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type === "recovery") {
    redirect(`/nouveau-mot-de-passe?token_hash=${encodeURIComponent(tokenHash)}`);
  }

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirect(type === "recovery" ? "/nouveau-mot-de-passe" : "/books");
    }
  }
  redirect(type === "recovery" ? "/mot-de-passe-oublie?erreur=lien" : "/?mode=login&erreur=lien");
}
