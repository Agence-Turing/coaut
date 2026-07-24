"use client";

import { useState } from "react";
import { Cta } from "@/components/Buttons";

const QUOTES = [
  "Nous aimons beaucoup écrire un livre avec nos copains. C'est très amusant de partager nos idées avec eux. C'est très motivant pour nous de voir que nos idées deviennent un livre. Nous apprenons à développer notre fantaisie en s'amusant.",
  "Je trouve bien d'écrire en groupe, de faire des histoires et aussi de faire un peu d'écriture pour réfléchir à l'orthographe.",
  "Co-Aut est un site génial, facile à utiliser et très original. Nous l'aimons beaucoup (et notre maman aussi).",
  "En tant qu'utilisateur, je trouve ça bien de faire des livres avec ses amis ou encore des inconnus ! J'aime bien écrire des livres, pour l'orthographe, pour l'imagination.",
];

export default function Temoignages() {
  const [index, setIndex] = useState(0);
  const prev = () => setIndex((i) => (i - 1 + QUOTES.length) % QUOTES.length);
  const next = () => setIndex((i) => (i + 1) % QUOTES.length);

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-20">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          Ils en parlent <span className="text-brand">mieux que moi</span>&nbsp;!
        </h2>
        <p className="mt-4 text-white/80">
          Regarde ce que pensent les co-auteurs qui partagent cette aventure
          amusante et pleine de créativité.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={prev}
            aria-label="Témoignage précédent"
            className="shrink-0 rounded-full border-2 border-white/40 p-2 transition-colors hover:border-brand hover:text-brand"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <blockquote className="flex min-h-44 flex-1 items-center justify-center rounded-3xl bg-white p-8 text-ink shadow-xl">
            <p className="italic">&ldquo;{QUOTES[index]}&rdquo;</p>
          </blockquote>

          <button
            type="button"
            onClick={next}
            aria-label="Témoignage suivant"
            className="shrink-0 rounded-full border-2 border-white/40 p-2 transition-colors hover:border-brand hover:text-brand"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {QUOTES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Aller au témoignage ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                i === index ? "bg-brand" : "bg-white/30"
              }`}
            />
          ))}
        </div>

        <Cta href="/signup" className="mt-10">
          Devenir co-auteur
        </Cta>
      </div>
    </section>
  );
}
