import { toggleFavorite } from "@/app/books/actions";

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
        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={`flex items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-bold transition-colors ${
          isFavorite
            ? "border-brand bg-brand text-white hover:bg-brand-dark"
            : "border-white/40 text-white hover:border-brand hover:text-brand"
        }`}
      >
        {isFavorite ? "❤️" : "🤍"} {count}
        <span className="hidden sm:inline">
          {isFavorite ? "Dans tes favoris" : "Ajouter aux favoris"}
        </span>
      </button>
    </form>
  );
}
