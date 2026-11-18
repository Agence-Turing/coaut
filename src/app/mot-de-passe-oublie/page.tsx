import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/PasswordForms";
import { LINK } from "@/components/ui";

export const metadata = { title: "Mot de passe oublié | Co-Aut" };

export default async function MotDePasseOublie({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return (
    <AuthShell
      studentLink
      title="Mot de passe oublié"
      intro="Indique l'email de ton compte : tu recevras un lien pour choisir un nouveau mot de passe. Si tu avais un compte sur l'ancienne version de Co-Aut, c'est aussi par ici que tu retrouves ton accès."
    >
      <ForgotPasswordForm
        initialError={
          erreur === "lien"
            ? "Ce lien n'est plus valable (déjà utilisé ou trop ancien). Demande-en un nouveau."
            : undefined
        }
      />
      <p className="mt-6 text-center text-sm">
        <Link href="/" className={`${LINK} inline-flex min-h-11 items-center`}>
          Retour à la connexion
        </Link>
      </p>
    </AuthShell>
  );
}
