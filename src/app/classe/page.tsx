import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import CodeForm from "@/components/classes/CodeForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Espace classe | Co-Aut" };

/** Entrée des élèves : un seul grand champ « Ton code ». */
export default async function ClassePage() {
  const user = await getCurrentUser();
  if (user?.isStudent) redirect("/classe/livres");

  return (
    <AuthShell
      title="Espace classe"
      intro="Ton enseignant t'a donné un code. Écris-le ici pour retrouver le livre de ta classe."
    >
      <CodeForm />
    </AuthShell>
  );
}
