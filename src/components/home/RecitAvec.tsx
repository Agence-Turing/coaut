import { Cta } from "@/components/Buttons";

const PUBLICS = [
  {
    illo: "/images/illu-amis.svg",
    label: (
      <>
        Des groupes <span className="text-brand">d&rsquo;amis</span>
      </>
    ),
  },
  {
    illo: "/images/illu-famille.svg",
    label: (
      <>
        Des membres d&rsquo;une <span className="text-brand">famille</span>
      </>
    ),
  },
  {
    illo: "/images/illu-passionnes.svg",
    label: (
      <>
        Des <span className="text-brand">passionnés</span>{" "}d&rsquo;écriture et
        de lecture
      </>
    ),
  },
  {
    illo: "/images/illu-enseignants.svg",
    label: (
      <>
        Des <span className="text-brand">enseignants</span>{" "}et leurs{" "}
        <span className="text-brand">élèves</span>
      </>
    ),
  },
];

export default function RecitAvec() {
  return (
    <section className="bg-white text-ink">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center md:px-6 md:py-20">
        <h3 className="font-display text-2xl font-bold md:text-3xl">
          Co-Aut est pensé pour créer un récit avec&nbsp;:
        </h3>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          {PUBLICS.map((p, i) => (
            <figure key={i} className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.illo} alt="" className="h-32 w-auto md:h-36" />
              <figcaption className="mt-4 font-display font-bold">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-graphite">
          Sur <strong className="text-brand">Co-Aut</strong>, on ne fait pas
          qu&rsquo;écrire une histoire, on construit un projet, on se divertit,
          on transforme sa créativité en mots, on voyage dans l&rsquo;imaginaire
          collectif.
        </p>

        <Cta href="/comment-ca-marche" className="mt-10">
          Découvrir Co-Aut
        </Cta>
      </div>
    </section>
  );
}
