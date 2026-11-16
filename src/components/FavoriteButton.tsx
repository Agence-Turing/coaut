import { toggleFavorite } from "@/app/books/actions";
import { BTN_SECONDARY } from "@/components/ui";

export default function FavoriteButton({
  bookId,
  bookRef,
  isFavorite,
  count,
}: {
  bookId: string;
  bookRef: string;
  isFavorite: boolean;
  count: number;
}) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="book_id" value={bookId} />
      <input type="hidden" name="book_ref" value={bookRef} />
      <input type="hidden" name="is_favorite" value={isFavorite ? "1" : "0"} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        className={`${BTN_SECONDARY} gap-2 ${isFavorite ? "border-ink bg-tint-rose" : ""}`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="text-accent"
        >
          <path d="M12 21s-7.5-4.6-10-9.3C.3 8 2.2 4 6 4c2 0 3.6 1 6 3.5C14.4 5 16 4 18 4c3.8 0 5.7 4 4 7.7C19.5 16.4 12 21 12 21z" />
        </svg>
        {isFavorite ? "Dans tes favoris" : "Ajouter aux favoris"}
        <span className="text-muted">· {count}</span>
      </button>
    </form>
  );
}
