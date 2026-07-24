import Image from "next/image";
import { Cta } from "@/components/Buttons";

const BADGES = [
  { icon: "/images/badge-joueurs.svg", label: "À partir de 2 joueurs" },
  { icon: "/images/badge-age.svg", label: "À partir de 6 ans et plus" },
  { icon: "/images/badge-devices.svg", label: "PC / tablette / mobile" },
];

export default function Hero() {
  return (
    <section className="bg-aubergine text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20">
        <div>
          <h1 className="font-display text-6xl font-extrabold text-brand md:text-7xl">
            Co-Aut
          </h1>
          <h2 className="mt-4 font-display text-2xl font-bold leading-snug md:text-3xl">
            La plateforme d&rsquo;écriture collaborative pour créer et se
            divertir
          </h2>
          <p className="mt-6 max-w-lg text-white/90">
            Bienvenue sur <strong className="text-peche">Co-Aut</strong>, le jeu
            créatif, ludique et éducatif pour t&rsquo;occuper intelligemment et
            t&rsquo;amuser en équipe&nbsp;!
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Cta href="/signup">M&apos;inscrire</Cta>
            <Cta href="/login" variant="outline">
              Me connecter
            </Cta>
          </div>
        </div>

        <div className="flex flex-col items-center gap-10">
          <Image
            src="/images/ensemble-livres-co-aut.svg"
            alt="Ensemble de livres de Co-Aut"
            width={420}
            height={260}
            priority
            className="w-full max-w-md"
          />
          <ul className="flex w-full items-start justify-center gap-8">
            {BADGES.map((b) => (
              <li key={b.label} className="flex max-w-[8.5rem] flex-col items-center text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.icon} alt="" className="h-16 w-16 md:h-20 md:w-20" />
                <p className="mt-3 text-sm text-white/90">{b.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
