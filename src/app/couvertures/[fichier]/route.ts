import { readFile } from "node:fs/promises";
import path from "node:path";

/** Dossier des couvertures, monté en volume dans le conteneur (voir AGENTS.md). */
const DOSSIER = process.env.COVERS_DIR ?? "/app/couvertures";

/** Même forme que la contrainte SQL books_cover_path_format : un nom de fichier, jamais un chemin. */
const NOM_VALIDE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}\.webp$/;

/** Sert la couverture d'un livre : /couvertures/<books.cover_path>. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fichier: string }> }
) {
  const { fichier } = await params;
  if (!NOM_VALIDE.test(fichier)) {
    return new Response("Introuvable", { status: 404 });
  }
  try {
    const image = await readFile(path.join(DOSSIER, fichier));
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        // Le nom porte une empreinte du contenu : une couverture refaite change de nom.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
