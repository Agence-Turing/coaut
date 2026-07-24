import Link from "next/link";

const BENEFITS = [
  "Construire un projet littéraire entre amis, en famille ou entre co-auteurs ;",
  "Améliorer ton orthographe et ton vocabulaire ;",
  "Challenger ton imaginaire et celui de ton équipe ;",
  "Partager tes rêves avec d'autres co-auteurs ;",
  "Révéler la créativité qui déborde en toi ;",
  "Développer ton esprit d'entreprendre ;",
  "Te divertir de façon intelligente ;",
  "Gagner en ouverture d'esprit.",
];

export function PenBullet() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/stylo-orange.svg" alt="" className="mt-1 h-4 w-4 shrink-0" />
  );
}

export default function EnJouant() {
  return (
    <section className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[5fr_7fr] md:px-6 md:py-20">
        <div
          className="relative overflow-hidden rounded-3xl bg-cover bg-center p-6 md:p-8"
          style={{ backgroundImage: "url(/images/livre-co-aut.jpg)" }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div className="relative rounded-2xl border-2 border-brand bg-ink/80 p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
              Actu du moment
            </p>
            <p className="mt-4 font-display text-xl font-bold text-brand">
              Équipe à rejoindre
            </p>
            <p className="mt-3 text-white">
              Colombe, Tome 1&nbsp;: De la cité des nuages
            </p>
            <p className="mt-2 text-sm text-peche">Niveau CM2</p>
            <Link
              href="/books"
              className="mt-6 inline-block rounded-full border-2 border-white px-6 py-2 text-sm font-bold transition-colors hover:bg-white hover:text-ink"
            >
              Je découvre
            </Link>
          </div>
          <div className="relative h-40 md:h-52" aria-hidden />
        </div>

        <div>
          <p className="text-lg">
            <strong className="text-brand">
              Créer une histoire entre co-auteurs
            </strong>{" "}
            et te faire plaisir en écrivant des récits.
          </p>
          <h3 className="mt-6 font-display text-2xl font-bold">
            En jouant, tu vas&nbsp;:
          </h3>
          <ul className="mt-5 space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <PenBullet />
                <span className="text-white/90">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 font-semibold text-peche">
            Une fois ton livre terminé, commande le livre imprimé auprès de
            Co-Aut.
          </p>
        </div>
      </div>
    </section>
  );
}
