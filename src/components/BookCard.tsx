import Link from "next/link";
import BookCover, { CoverBadge } from "@/components/BookCover";
import { EYEBROW } from "@/components/ui";
import { BookSummary, bookRef, playersOf, splitTitle, turnsCountOf } from "@/lib/books";

/** Un livre sur l'étagère : sa couverture, puis thème et repères en dessous. */
export default function BookCard({
  book,
  flags,
  favCount = 0,
  coverPath,
}: {
  book: BookSummary;
  flags?: { launcher?: boolean; myTurn?: boolean };
  favCount?: number;
  coverPath?: string | null;
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

  return (
    <Link
      href={`/books/${bookRef(book)}`}
      className="group flex min-w-0 flex-col gap-3.5 text-ink"
    >
      <div className="transition-transform duration-200 group-hover:-translate-y-1">
        <BookCover
          seed={book.legacy_code ?? book.id}
          title={main}
          coverPath={coverPath}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {(flags?.myTurn || flags?.launcher || (!flags && freeSeats !== null && freeSeats > 0)) && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {flags?.myTurn && <CoverBadge tone="brand">À toi d&rsquo;écrire</CoverBadge>}
            {flags?.launcher && <CoverBadge>Lancé par toi</CoverBadge>}
            {!flags && freeSeats !== null && freeSeats > 0 && (
              <CoverBadge>
                {freeSeats} place{freeSeats > 1 ? "s" : ""} libre{freeSeats > 1 ? "s" : ""}
              </CoverBadge>
            )}
          </div>
        )}
        {volume && <p className="text-[15px] font-semibold text-ink">{volume}</p>}
        {written && <p className="text-sm text-muted">{written}</p>}
        {theme && <p className={`${EYEBROW} truncate`}>{theme}</p>}
        <p className="text-sm text-muted">
          {turns} tour{turns > 1 ? "s" : ""}
          {launcher
            ? ` · lancé par ${launcher}`
            : players.length > 0
              ? ` · ${players.join(", ")}`
              : ""}
        </p>
        {favCount > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
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
          </p>
        )}
      </div>
    </Link>
  );
}

/** Grille en étagère, commune à toutes les listes de livres. */
export function BookShelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 sm:gap-x-7 lg:grid-cols-4">
      {children}
    </div>
  );
}
