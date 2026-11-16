import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Arrivée depuis un lien reçu par e-mail (mot de passe oublié, confirmation d'adresse).
 * Le lien porte un jeton à usage unique : on l'échange ici contre une session,
 * côté serveur, car l'API Supabase n'est pas exposée au navigateur.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

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
  redirect("/mot-de-passe-oublie?erreur=lien");
}
