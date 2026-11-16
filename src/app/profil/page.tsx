import type { Metadata } from "next";
import { redirect } from "next/navigation";
import BirthDateForm from "@/components/BirthDateForm";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import { ageFrom, getBirthDate } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon profil | Co-Aut" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink/10 py-5 last:border-0">
      <p className="text-xs font-bold uppercase tracking-wide text-ink/50">
        {label}
      </p>
      <div className="mt-1 text-ink">{children}</div>
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

  return (
    <>
      <Header user={user} />
      <main className="flex-1 bg-white">
        <section className="bg-aubergine text-white">
          <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Mon <span className="text-brand">profil</span>
            </h1>
            <p className="mt-3 text-white/85">
              Les autres co-auteurs ne voient que ton pseudonyme. Ton email et
              ta date de naissance restent privés.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          {!birthDate && (
            <p className="mb-6 rounded-2xl bg-peche/30 px-5 py-4 text-sm font-semibold text-aubergine">
              Il nous manque ta date de naissance. Elle sert à te proposer des
              livres écrits avec des co-auteurs de ton âge.
            </p>
          )}
          <div className="rounded-3xl border border-ink/10 px-6">
            <Row label="Pseudonyme">{user.nickname}</Row>
            <Row label="Email">{account?.email ?? "—"}</Row>
            <Row label="Âge">
              {birthDate ? `${ageFrom(birthDate)} ans` : "Inconnu pour l'instant"}
            </Row>
            <Row label="Date de naissance">
              <BirthDateForm birthDate={birthDate} maxDate={today} />
            </Row>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
