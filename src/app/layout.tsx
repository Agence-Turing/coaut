import type { Metadata } from "next";
import { Open_Sans, Roboto_Slab } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Co-Aut | La plateforme d'écriture collaborative pour t'amuser",
  description:
    "Co-Aut, le jeu créatif, ludique et éducatif pour écrire des livres en équipe. Crée une histoire entre co-auteurs, amuse-toi et commande ton livre imprimé.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${openSans.variable} ${robotoSlab.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
