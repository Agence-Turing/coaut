import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { NewPasswordForm } from "@/components/PasswordForms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nouveau mot de passe | Co-Aut" };

export default async function NouveauMotDePasse({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string | string[] }>;
}) {
  const raw = (await searchParams).token_hash;
  const tokenHash = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  // Avec le jeton du mail, il sera vérifié à l'envoi du formulaire ; sans lui, il faut une session.
  if (!tokenHash) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/mot-de-passe-oublie?erreur=lien");
  }

  return (
    <AuthShell
      title="Choisis ton nouveau mot de passe"
      intro="Tu seras ensuite connecté directement."
    >
      <NewPasswordForm tokenHash={tokenHash} />
    </AuthShell>
  );
}
