import Image from "next/image";
import Link from "next/link";
import { Cta } from "@/components/Buttons";
import { PenBullet } from "@/components/home/EnJouant";

const CLASSE_IDEES = [
  "Tes élèves peuvent réaliser ensemble une production écrite tout au long de l'année.",
  "Ta classe peut écrire un livre avec une autre classe ou une autre école.",
  "Tu veux donner une dimension sociale à ton projet ? Pourquoi ne pas écrire un livre avec des personnes âgées, ou encore des jeunes en situation de handicap ?",
  "Tu veux aller encore plus loin ? Propose à tes élèves un projet créatif inoubliable et unique. Écrire une histoire en ligne avec d'autres écoles Françaises ou francophones à l'international.",
];

export default function CommentEcrire() {
  return (
    <section className="bg-white text-ink">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Comment écrire une <span className="text-brand">histoire</span>{" "}sur
          Co-Aut&nbsp;?
        </h2>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="text-graphite">
              Pour <strong>créer un projet littéraire</strong>{" "}sur la
              plateforme, rien de plus simple&nbsp;! Il te suffit de lancer un
              livre ou de rejoindre le livre d&rsquo;un autre lanceur.
            </p>

            <p className="mt-6 flex items-start gap-3 font-display font-bold">
              <PenBullet />
              Tu as une idée d&rsquo;histoire&nbsp;?
            </p>
            <p className="mt-2 text-graphite">
              Choisis un thème, trouve un titre, écris ton synopsis et construis
              ton équipe avec le nombre de co-auteurs que tu veux à tes côtés.
            </p>

            <p className="mt-6 flex items-start gap-3 font-display font-bold">
              <PenBullet />
              Tu es inspiré par les histoires des autres&nbsp;?
            </p>
            <p className="mt-2 text-graphite">
              Découvre les livres en cours et rejoins l&rsquo;équipe pour
              construire le récit tous ensemble.
            </p>
          </div>

          <Image
            src="/images/histoire-co-aut.jpg"
            alt="Livre d'histoire de Co-Aut"
            width={560}
            height={373}
            className="w-full rounded-3xl object-cover shadow-xl"
          />
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-graphite">
          Et si tu as envie de voyager dans l&rsquo;imaginaire de la communauté,
          viens découvrir la{" "}
          <strong>bibliothèque avec les livres déjà écrits en équipe</strong>{" "}
          sur <strong className="text-brand">Co-Aut</strong>.
        </p>

        <h2 className="mt-16 text-center font-display text-3xl font-bold md:text-4xl">
          Envie de lancer{" "}
          <span className="text-brand">un projet d&rsquo;écriture</span>{" "}pour ta
          classe&nbsp;?
        </h2>

        <p className="mx-auto mt-6 max-w-3xl text-center text-graphite">
          Prends{" "}
          <Link
            href="/contact"
            className="font-semibold text-brand underline underline-offset-2 hover:text-brand-dark"
          >
            contact
          </Link>{" "}
          avec Juliette, et dès que tu es prêt, lance un livre pour tes élèves
          sur Co-Aut. Des idées de projets, on n&rsquo;en manque pas&nbsp;!
        </p>

        <ul className="mx-auto mt-8 max-w-3xl space-y-4">
          {CLASSE_IDEES.map((idee) => (
            <li key={idee} className="flex items-start gap-3 text-graphite">
              <PenBullet />
              <span>{idee}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-3xl text-center font-semibold">
          Et pour finir l&rsquo;année, les familles repartent avec le livre
          imprimé, écrit par son enfant et ses camarades.
        </p>

        <div className="mt-10 text-center">
          <Cta href="/comment-ca-marche">Découvrir Co-Aut</Cta>
        </div>
      </div>
    </section>
  );
}
