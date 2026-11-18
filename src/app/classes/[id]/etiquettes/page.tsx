import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/classes/PrintButton";
import { LINK } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedClass, listStudents } from "@/lib/classes";
import { siteUrl } from "@/lib/mail/config";

export const metadata: Metadata = { title: "Codes de la classe | Co-Aut" };

/** Planche A4 d'étiquettes à découper : prénom, code, adresse de l'espace classe. */
export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/?mode=login");
  if (!user.authorId || !user.isProfessional) redirect("/classes");
  const cls = await getOwnedClass(id, user.authorId);
  if (!cls) notFound();
  const students = (await listStudents(cls.id)).filter((s) => s.code);
  const address = `${siteUrl().replace(/^https?:\/\//, "")}/classe`;

  return (
    <main className="mx-auto w-full max-w-[210mm] px-4 py-8 print:p-0">
      <style>{`@page { size: A4; margin: 10mm; }`}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/classes/${cls.id}`} className={`${LINK} inline-flex min-h-11 items-center text-[15px]`}>
          ← {cls.name}
        </Link>
        <PrintButton />
      </div>
      <p className="mb-4 text-sm text-muted print:hidden">
        Une étiquette par élève, à découper et à coller dans le cahier de liaison.
      </p>
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 print:grid-cols-2">
        {students.map((s) => (
          <div
            key={s.id}
            className="flex break-inside-avoid flex-col gap-1.5 border border-dashed border-line-strong px-5 py-4"
          >
            <p className="font-display text-xl font-bold text-ink">{s.first_name}</p>
            <p className="text-sm text-muted">Ton code Co-Aut</p>
            <p className="text-2xl font-bold tracking-[0.12em] text-ink">{s.code}</p>
            <p className="text-sm text-ink">
              Va sur <strong className="font-semibold">{address}</strong>
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
