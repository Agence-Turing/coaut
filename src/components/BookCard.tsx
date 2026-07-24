import Link from "next/link";
import {
  BookSummary,
  bookRef,
  playersOf,
  turnsCountOf,
} from "@/lib/books";

export default function BookCard({
  book,
  flags,
  favCount = 0,
}: {
  book: BookSummary;
  flags?: { launcher?: boolean; myTurn?: boolean };
  favCount?: number;
}) {
  const players = playersOf(book);
  const turns = turnsCountOf(book);

  return (
    <Link
      href={`/books/${bookRef(book)}`}
      className="group flex h-full min-w-0 flex-col break-words rounded-3xl border border-ink/10 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex flex-wrap items-center gap-2">
        {flags?.myTurn && (
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
            ✍️ À toi d&rsquo;écrire !
          </span>
        )}
        {flags?.launcher && (
          <span className="rounded-full bg-aubergine px-3 py-1 text-xs font-bold text-white">
            Lancé par toi
          </span>
        )}
        {book.themes.map((t) => (
          <span
            key={t}
            className="rounded-full bg-peche/30 px-3 py-1 text-xs font-semibold text-brand-dark"
          >
            {t}
          </span>
        ))}
        {book.scolar_level && (
          <span className="rounded-full bg-aubergine/10 px-3 py-1 text-xs font-semibold text-aubergine">
            {book.scolar_level}
          </span>
        )}
      </div>

      <h3 className="mt-4 font-display text-lg font-bold leading-snug text-ink group-hover:text-brand">
        {book.title}
      </h3>

      {book.synopsis && (
        <p className="mt-3 line-clamp-4 text-sm text-graphite">
          {book.synopsis}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-graphite/80">
        <span className="truncate">
          {players.length > 0
            ? `✍️ ${players.join(", ")}`
            : "En attente de co-auteurs"}
        </span>
        <span className="flex shrink-0 items-center gap-3 font-semibold">
          {favCount > 0 && (
            <span className="text-brand-dark" title="Ajouté en favoris">
              ❤️ {favCount}
            </span>
          )}
          {turns} tour{turns > 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
