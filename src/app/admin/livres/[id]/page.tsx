import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addPlayer,
  booksAction,
  removePlayer,
  setLauncher,
  setMaxPlayers,
  updateBook,
} from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/client";
import { SMALL_BTN, SMALL_BTN_DANGER, Tag } from "@/components/admin/table";
import { BTN_PRIMARY, BTN_SECONDARY, EYEBROW, INPUT, LABEL, LINK, Notice } from "@/components/ui";
import {
  statusLabel,
  UUID_RE,
  bookCode,
  daysSince,
  formatDate,
  type AdminBookRow,
} from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { noticeFrom } from "@/lib/admin/messages";
import { deName } from "@/lib/fr";
import { NIVEAUX } from "@/lib/niveaux";

/** « d' » ou « de » devant le pseudo : « au tour d'André », « au tour de Léa ». */
const aTourDe = (pseudo: string) => deName(pseudo).slice(0, -pseudo.length);

const SECTION = "flex flex-col gap-4 rounded-2xl border border-line p-4 sm:p-6";
const H2 = "font-display text-2xl font-bold text-ink";

export default async function AdminBookPage({ params, searchParams }: PageProps<"/admin/livres/[id]">) {
  const { db, authorId } = await requireAdminPage();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;

  const [{ data: bookData }, { data: teamData }, { data: nicknames }, { data: levelData }] =
    await Promise.all([
      db.from("admin_books").select("*").eq("id", id).maybeSingle(),
      db
        .from("book_players")
        .select("author_id, position, joined_at, authors(nickname, deleted_at)")
        .eq("book_id", id)
        .order("position")
        .order("joined_at"),
      db
        .from("authors")
        .select("nickname")
        .eq("kind", "adult")
        .is("deleted_at", null)
        .order("nickname")
        .limit(5000),
      db.from("books").select("scolar_level").eq("id", id).maybeSingle(),
    ]);
  if (!bookData) notFound();
  const level = (levelData?.scolar_level as string | null) ?? "";
  const book = bookData as AdminBookRow;
  const team = (teamData ?? []) as unknown as {
    author_id: string;
    position: number;
    authors: { nickname: string; deleted_at: string | null } | null;
  }[];
  const back = `/admin/livres/${id}`;
  const notice = noticeFrom(sp);
  const launched = book.status === "launched";
  // Depuis quand l'auteur dont c'est le tour a la main (migration 0017, même date que le filtre
  // « Tours en retard » de la page Tours).
  const since = daysSince(book.waiting_since);
  const meInTeam = Boolean(authorId && team.some((p) => p.author_id === authorId));
  const currentIdx = team.findIndex((p) => p.author_id === book.current_writer_id);
  // Équipe incomplète (règle « équipe au complet », hors livres de classe) : personne n'écrit.
  const waitingFor =
    !book.class_id && book.max_players ? Math.max(book.max_players - team.length, 0) : 0;
  const next = currentIdx >= 0 && team.length > 1 ? team[(currentIdx + 1) % team.length] : null;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/livres" className={`${LINK} text-sm`}>
          Retour aux livres
        </Link>
        <p className={EYEBROW}>
          Livre {book.legacy_code ?? "nouveau"} · lancé le {formatDate(book.created_at)}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight text-ink">{book.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Tag tone={book.status === "archived" ? "warn" : "neutral"}>{statusLabel(book)}</Tag>
          {book.class_id ? (
            <Link href={`/admin/classes/${book.class_id}`} className={LINK}>
              Livre de la classe {book.class_name}
              {book.teacher_review ? " (relu par le prof)" : ""}
            </Link>
          ) : (
            <span className="text-muted">Public</span>
          )}
          {book.status !== "archived" && (
            <Link href={`/books/${bookCode(book)}`} className={LINK}>
              Voir la page du livre
            </Link>
          )}
          <Link href={`/admin/tours?livre_id=${book.id}&tri=numero&ordre=asc`} className={LINK}>
            {book.turns_count === 0
              ? "Aucun tour"
              : book.turns_count === 1
                ? "Voir son tour"
                : `Voir ses ${book.turns_count} tours`}
          </Link>
        </div>
      </div>

      <Notice info={notice.info} error={notice.error} />

      {launched && (
        <section className={SECTION} aria-labelledby="ecriture">
          <h2 id="ecriture" className={H2}>
            Écriture
          </h2>
          {book.current_writer_nickname ? (
            <p className="text-[17px] text-ink">
              C&apos;est au tour {aTourDe(book.current_writer_nickname)}
              <strong>{book.current_writer_nickname}</strong>
              {since !== null && <span className="text-muted"> (depuis {since} j)</span>}.
              {next && (
                <>
                  {" "}
                  Ensuite : {next.authors?.nickname}.
                </>
              )}
            </p>
          ) : team.length === 0 ? (
            <p className="text-muted">Personne pour l&apos;instant : l&apos;équipe est vide.</p>
          ) : waitingFor > 0 ? (
            <p className="text-[17px] text-ink">
              En attente de l&apos;équipe :{" "}
              {waitingFor > 1
                ? `${waitingFor} places sur ${book.max_players} restent à pourvoir`
                : `1 place sur ${book.max_players} reste à pourvoir`}
              . L&apos;écriture reprend dès que l&apos;équipe est au complet (ou baisse le nombre de
              places ci-dessous).
            </p>
          ) : (
            <p className="text-muted">Personne ne peut écrire pour l&apos;instant.</p>
          )}
          {team.length > 1 && book.current_writer_nickname && (
            <form action={booksAction}>
              <input type="hidden" name="back" value={back} />
              <ConfirmButton
                name="do"
                value={`passe:${book.id}`}
                className={BTN_SECONDARY}
                message={`Passer le tour de ${book.current_writer_nickname ?? "l'auteur actuel"} ? Son brouillon en cours sera supprimé.`}
              >
                Passer le tour
              </ConfirmButton>
            </form>
          )}
        </section>
      )}

      <section className={SECTION} aria-labelledby="equipe">
        <h2 id="equipe" className={H2}>
          Équipe ({team.length}
          {book.max_players ? ` sur ${book.max_players}` : ""})
        </h2>
        <p className="text-sm text-muted">
          Dans l&apos;ordre de passage.
          {!book.class_id && team.length > 0 &&
            (book.launcher_id && team.some((p) => p.author_id === book.launcher_id)
              ? " Lanceur parti ? « Faire lanceur » donne ses droits à un autre co-auteur (demandes pour rejoindre, publication, places)."
              : ` Le lanceur${book.launcher_nickname ? ` (${book.launcher_nickname})` : ""} n'est plus dans l'équipe : « Faire lanceur » donne ses droits à un co-auteur (demandes pour rejoindre, publication, places).`)}
        </p>
        <ol className="flex flex-col">
          {team.map((p, i) => (
            <li
              key={p.author_id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0"
            >
              <span className="text-[16px] text-ink">
                {i + 1}.{" "}
                <Link href={`/admin/auteurs/${p.author_id}`} className={LINK}>
                  {p.authors?.nickname}
                </Link>
                {p.author_id === book.launcher_id && <span className="text-muted"> · lanceur</span>}
                {launched && p.author_id === book.current_writer_id && (
                  <>
                    {" "}
                    <Tag tone="soft">son tour</Tag>
                  </>
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {!book.class_id && p.author_id !== book.launcher_id && (
                  <form action={setLauncher}>
                    <input type="hidden" name="back" value={back} />
                    <input type="hidden" name="book_id" value={book.id} />
                    <input type="hidden" name="author_id" value={p.author_id} />
                    <ConfirmButton
                      className={SMALL_BTN}
                      message={`Faire de ${p.authors?.nickname} le lanceur du livre ? C'est lui qui recevra les demandes pour rejoindre (et leurs mails), pourra publier le livre et régler le nombre de places.${book.launcher_nickname ? ` ${book.launcher_nickname} perd ces droits${team.some((m) => m.author_id === book.launcher_id) ? " et reste co-auteur" : ""}.` : ""}`}
                    >
                      Faire lanceur
                    </ConfirmButton>
                  </form>
                )}
                <form action={removePlayer}>
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="book_id" value={book.id} />
                  <input type="hidden" name="author_id" value={p.author_id} />
                  <ConfirmButton
                    className={SMALL_BTN_DANGER}
                    message={`Retirer ${p.authors?.nickname} de l'équipe ? Ses tours écrits restent ; son brouillon en cours est supprimé.`}
                  >
                    Retirer
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ol>

        <form action={addPlayer} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="book_id" value={book.id} />
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={LABEL}>Ajouter un co-auteur (pseudo exact)</span>
            <input name="nickname" list="pseudos" required className={INPUT} autoComplete="off" />
          </label>
          <button type="submit" className={BTN_SECONDARY}>
            Ajouter
          </button>
        </form>
        <datalist id="pseudos">
          {(nicknames ?? []).map((a) => (
            <option key={a.nickname as string} value={a.nickname as string} />
          ))}
        </datalist>
        {!meInTeam && authorId && (
          <form action={addPlayer}>
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="book_id" value={book.id} />
            <input type="hidden" name="me" value="1" />
            <button type="submit" className={SMALL_BTN}>
              M&apos;ajouter à l&apos;équipe
            </button>
          </form>
        )}

        <form action={setMaxPlayers} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="id" value={book.id} />
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Nombre de co-auteurs souhaité</span>
            <input
              type="number"
              name="max_players"
              min={Math.max(1, team.length)}
              max={30}
              defaultValue={book.max_players ?? team.length}
              className={`${INPUT} sm:w-40`}
            />
          </label>
          <button type="submit" className={BTN_SECONDARY}>
            Enregistrer
          </button>
        </form>
      </section>

      <section className={SECTION} aria-labelledby="texte">
        <h2 id="texte" className={H2}>
          Titre, résumé et niveau
        </h2>
        <form action={updateBook} className="flex flex-col gap-4">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="id" value={book.id} />
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Titre</span>
            <input name="title" required minLength={3} defaultValue={book.title} className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Résumé</span>
            <textarea
              name="synopsis"
              rows={6}
              defaultValue={book.synopsis ?? ""}
              className={`${INPUT} min-h-32`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Niveau</span>
            <select name="scolar_level" defaultValue={level} className={`${INPUT} sm:max-w-xs`}>
              <option value="">Sans niveau</option>
              {level && !NIVEAUX.some((n) => n.value === level) && (
                <option value={level}>{level}</option>
              )}
              {NIVEAUX.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`${BTN_PRIMARY} self-start`}>
            Enregistrer
          </button>
        </form>
      </section>

      <section className={SECTION} aria-labelledby="statut">
        <h2 id="statut" className={H2}>
          Statut
        </h2>
        <form action={booksAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="back_after_delete" value="/admin/livres" />
          {book.status !== "published" && (
            <ConfirmButton
              name="do"
              value={`publie:${book.id}`}
              className={BTN_SECONDARY}
              message="Publier ce livre ? Le brouillon en cours est clos, l'équipe reçoit le mail « livre publié »."
            >
              Publier
            </ConfirmButton>
          )}
          {book.status !== "launched" && (
            <button type="submit" name="do" value={`relance:${book.id}`} className={BTN_SECONDARY}>
              Remettre en cours
            </button>
          )}
          {book.status !== "archived" && (
            <button type="submit" name="do" value={`archive:${book.id}`} className={BTN_SECONDARY}>
              Archiver
            </button>
          )}
          <ConfirmButton
            name="do"
            value={`supprime:${book.id}`}
            className={`${SMALL_BTN_DANGER} min-h-11 px-5 text-[15px]`}
            message={`Supprimer définitivement « ${book.title} », son équipe et ${book.turns_count > 1 ? `ses ${book.turns_count} tours` : book.turns_count === 1 ? "son tour" : "aucun tour écrit"} ?`}
          >
            Supprimer le livre
          </ConfirmButton>
        </form>
        <p className="text-sm text-muted">
          Archiver retire le livre du site sans rien effacer. Supprimer efface tout, sans retour possible.
        </p>
      </section>
    </div>
  );
}
