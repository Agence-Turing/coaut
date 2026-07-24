import { Cta } from "@/components/Buttons";

export default function PlusQuUnePlateforme() {
  return (
    <section className="bg-white text-ink">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-6 md:py-20">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Co-Aut&hellip; bien plus qu&rsquo;une simple{" "}
          <span className="text-brand">plateforme d&rsquo;écriture</span>&nbsp;!
        </h2>

        <p className="mt-8 text-graphite">
          De 6 à 99 ans, enfants, adultes et élèves se rassemblent pour
          inventer, créer et construire des histoires entre co-auteurs.
          C&rsquo;est une communauté animée par la même motivation&nbsp;:
          collaborer autour d&rsquo;un projet à la fois personnel et collectif
          pour <strong>écrire un livre unique et authentique</strong>. Ensemble,
          on plonge dans l&rsquo;imaginaire et on pose des mots sur tout ce qui
          se dessine dans nos têtes chaque jour.
        </p>

        <p className="mt-6 font-display font-bold text-brand-dark">
          Résultat&nbsp;? Des récits captivants, authentiques et
          passionnants&nbsp;!
        </p>

        <p className="mt-6 text-graphite">
          Et si le <strong>plaisir d&rsquo;écrire</strong>{" "}et d&rsquo;inventer
          est au c&oelig;ur du jeu, on y retrouve même le goût des mots et de la
          lecture. Une seule règle&nbsp;: te faire plaisir et laisser ta
          créativité s&rsquo;exprimer dans un jeu de rôle aussi divertissant que
          challengeant.
        </p>

        <p className="mt-6 text-graphite">
          Alors&hellip; laisse-toi aller et{" "}
          <strong className="text-brand">
            libère enfin toute ton imagination
          </strong>
          &nbsp;!
        </p>

        <Cta href="/books" className="mt-10">
          Participer à un livre
        </Cta>
      </div>
    </section>
  );
}
