import Link from "next/link";
import BookCover, { CoverBadge } from "@/components/BookCover";
import { EYEBROW } from "@/components/ui";
import { BookSummary, bookRef, playersOf, splitTitle, turnsCountOf } from "@/lib/books";

/**
 * Un livre dans une liste : fiche en largeur, toute cliquable.
 * À gauche la petite couverture colorée ; à droite thème, titre (tome, dates),
 * début du résumé sur quelques lignes, repères et pastilles.
 */
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
  const launcher = book.book_players.find((p) => p.author_id === book.launcher_id)
    ?.authors?.nickname;
  const freeSeats =
    book.status === "launched" && book.max_players
      ? Math.max(book.max_players - book.book_players.length, 0)
      : null;
  const theme = book.themes.join(" · ");
  const { main, volume, written } = splitTitle(book.title);
  const subtitle = [volume, written].filter(Boolean).join(" · ");
  const synopsis = book.synopsis?.replace(/\s+/g, " ").trim();

  const facts = [
    `${turns} tour${turns > 1 ? "s" : ""}`,
    launcher
      ? `lancé par ${launcher}`
      : players.length > 0
        ? players.join(", ")
        : null,
    // Places libres : seulement dans « Rejoindre un livre » (liste sans pastilles personnelles).
    !flags && freeSeats !== null && freeSeats > 0
      ? `${freeSeats} place${freeSeats > 1 ? "s" : ""} libre${freeSeats > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={`/books/${bookRef(book)}`}
      className="group flex min-w-0 gap-3.5 rounded-xl border border-line bg-paper p-3.5 text-ink transition-colors hover:border-line-strong sm:gap-5 sm:p-4"
    >
      <div className="w-[68px] shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 sm:w-[92px]">
        <BookCover seed={book.legacy_code ?? book.id} title={main} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {theme && <p className={`${EYEBROW} truncate`}>{theme}</p>}
        <h3 className="break-words font-display text-lg font-bold leading-tight text-ink underline-offset-2 group-hover:underline sm:text-xl">
          {main}
        </h3>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        {synopsis && (
          <p className="mt-0.5 line-clamp-4 break-words text-[15px] leading-snug text-muted">
            {synopsis}
          </p>
        )}
        <p className="mt-1 text-sm text-subtle">{facts.join(" · ")}</p>
        {(favCount > 0 || flags?.myTurn || flags?.launcher) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {flags?.myTurn && <CoverBadge tone="brand">À toi d&rsquo;écrire</CoverBadge>}
            {flags?.launcher && <CoverBadge>Lancé par toi</CoverBadge>}
            {favCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-ink">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="text-accent"
                >
                  <path d="M12 21s-7.5-4.6-10-9.3C.3 8 2.2 4 6 4c2 0 3.6 1 6 3.5C14.4 5 16 4 18 4c3.8 0 5.7 4 4 7.7C19.5 16.4 12 21 12 21z" />
                </svg>
                {favCount} favori{favCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Liste des livres, commune à toutes les pages : une fiche par ligne sur téléphone, deux sur ordinateur. */
export function BookShelf({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">{children}</div>;
}
