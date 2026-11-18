import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BirthDateForm from "@/components/BirthDateForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import ProfessionalForm from "@/components/classes/ProfessionalForm";
import { EYEBROW, Notice, PageHeading } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { ageFrom, getBirthDate } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon profil | Co-Aut" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5 last:border-0">
      <p className={EYEBROW}>{label}</p>
      <div className="mt-1.5 break-words text-[17px] text-ink">{children}</div>
    </div>
  );
}

export default async function ProfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");

  const supabase = await createClient();
  const {
    data: { user: account },
  } = await supabase.auth.getUser();
  const birthDate = user.authorId
    ? await getBirthDate(supabase, user.authorId)
    : null;
  const today = new Date().toISOString().slice(0, 10);
  const { data: pro } = user.authorId
    ? await supabase
        .from("author_profiles")
        .select("is_professional, organization")
        .eq("author_id", user.authorId)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pb-20 pt-12 sm:px-6">
        <PageHeading
          title="Mon profil"
          intro="Les autres co-auteurs ne voient que ton pseudonyme. Ton email et ta date de naissance restent privés."
        />
        {!birthDate && (
          <Notice info="Il nous manque ta date de naissance. Elle sert à te proposer des livres écrits avec des co-auteurs de ton âge." />
        )}
        <div className="rounded-2xl border border-line px-5 sm:px-6">
          <Row label="Pseudonyme">{user.nickname}</Row>
          <Row label="Email">{account?.email ?? "Inconnu"}</Row>
          <Row label="Âge">
            {birthDate ? `${ageFrom(birthDate)} ans` : "Inconnu pour l'instant"}
          </Row>
          <Row label="Date de naissance">
            <BirthDateForm birthDate={birthDate} maxDate={today} />
          </Row>
          <Row label="Enseignant ou professionnel">
            <ProfessionalForm
              isProfessional={Boolean(pro?.is_professional)}
              organization={(pro?.organization as string | null) ?? null}
            />
          </Row>
        </div>
      </main>
      <Footer />
    </>
  );
}
