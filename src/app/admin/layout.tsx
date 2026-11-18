import type { Metadata } from "next";
import Header from "@/components/Header";
import { AdminNav } from "@/components/admin/client";
import { getCurrentUser } from "@/lib/auth";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Administration | Co-Aut",
  robots: { index: false, follow: false },
};

/** Administration : réservée aux comptes de public.admins (chaque page revérifie le rôle). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const user = await getCurrentUser();
  return (
    <>
      <Header user={user} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-20 pt-8 sm:px-6">
        <AdminNav />
        {children}
      </main>
    </>
  );
}
