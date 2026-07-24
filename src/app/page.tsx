import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Wave from "@/components/Wave";
import Hero from "@/components/home/Hero";
import EnJouant from "@/components/home/EnJouant";
import ReveleAuteur from "@/components/home/ReveleAuteur";
import RecitAvec from "@/components/home/RecitAvec";
import PlusQuUnePlateforme from "@/components/home/PlusQuUnePlateforme";
import CommentEcrire from "@/components/home/CommentEcrire";
import Temoignages from "@/components/home/Temoignages";
import Faq from "@/components/home/Faq";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <EnJouant />
        <ReveleAuteur />
        <RecitAvec />
        <Wave className="h-10 bg-white text-ink md:h-14" />
        <PlusQuUnePlateforme />
        <Wave className="h-10 bg-white text-ink md:h-14" />
        <CommentEcrire />
        <Temoignages />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
