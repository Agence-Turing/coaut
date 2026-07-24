const FAQ = [
  {
    q: "Est-ce que le site est sécurisé ?",
    a: "Oui ! Les informations personnelles ne sont pas visibles et aucun moyen de communication entre auteurs n'est possible en dehors de la zone d'écriture du texte. C'est le moyen de garantir la sécurité de tous, même des plus jeunes.",
  },
  {
    q: "Qui peut utiliser la plateforme d'écriture ?",
    a: "Tout le monde ! Inclusive et collaborative, Co-Aut est un espace pour s'amuser et partager sans discriminations. Afin de respecter l'anonymat, chaque auteur utilise un pseudonyme.",
  },
  {
    q: "Existe-t-il une modération sur la plateforme d'écriture ?",
    a: "Les textes rédigés par la communauté sont toujours vérifiés afin de garantir la sécurité et le respect de tous.",
  },
  {
    q: "Est-ce que l'inscription sur Co-Aut est gratuite ?",
    a: "Oui ! Et l'écriture de livres l'est tout autant ! L'achat du livre imprimé en papier recyclé est payant. Contacte directement Co-Aut pour plus d'informations sur l'achat de ton livre.",
  },
  {
    q: "Est-ce que les fautes sont corrigées ?",
    a: "Il peut arriver que des corrections avec une explication soient réalisées, notamment pour les livres rédigés par des enfants. Cependant, nous invitons chaque auteur à se relire seul ou à l'aide d'un adulte.",
  },
  {
    q: "Un enfant peut-il écrire un livre avec un adulte ?",
    a: "Jouer entre enfants et adultes est possible uniquement avec des connaissances (cercle amical ou familial) afin d'assurer la sécurité des plus jeunes.",
  },
  {
    q: "Comment contacter Co-Aut ?",
    a: "Tu peux utiliser la page contact ou répondre directement à tes notifications de jeu.",
  },
];

export default function Faq() {
  return (
    <section className="bg-maroon text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Je réponds à toutes tes questions sur le fonctionnement de la{" "}
          <span className="text-brand">plateforme d&rsquo;écriture</span>
        </h2>

        <div className="mt-12 grid items-center gap-10 md:grid-cols-[5fr_7fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/faq-co-aut.svg"
            alt="FAQ Co-Aut"
            className="mx-auto w-full max-w-sm"
          />

          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl bg-white/5 px-5 py-4 open:bg-white/10"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold marker:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-xl font-bold text-brand transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-white/85">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
