import Image from "next/image";

export default function ReveleAuteur() {
  return (
    <section className="bg-aubergine text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:px-6">
        <div>
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Révèle <span className="text-brand">l&rsquo;auteur</span>{" "}en
            toi&nbsp;!
          </h2>
          <p className="mt-6 text-white/90">
            Tout le monde a sa place sur <strong>Co-Aut</strong>&nbsp;! Les
            élèves aussi&nbsp;! Que tu sois rêveur, curieux, fantaisiste,
            sérieux ou audacieux, viens t&rsquo;amuser et écrire un livre sur ta{" "}
            <strong className="text-peche">
              plateforme d&rsquo;écriture collaborative
            </strong>
            .
          </p>
        </div>
        <Image
          src="/images/enfant-auteur-livre.jpg"
          alt="Enfant auteur qui écrit un livre sur une île imaginaire"
          width={560}
          height={370}
          className="w-full rounded-3xl object-cover shadow-2xl"
        />
      </div>
    </section>
  );
}
