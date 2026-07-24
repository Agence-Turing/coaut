import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { WaveBand } from "@/components/Wave";
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
        <WaveBand className="bg-white" />
        <PlusQuUnePlateforme />
        <WaveBand className="bg-white" />
        <CommentEcrire />
        <Temoignages />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
