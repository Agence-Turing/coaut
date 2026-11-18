import Anthropic from "@anthropic-ai/sdk";
import { TYPES_CORRECTION, type Proposition } from "./filtre.ts";

/**
 * Appel à Claude : liste des fautes d'un texte, jamais le texte lui-même.
 * Renvoie null si l'IA ne répond pas à temps ou en erreur : l'envoi du tour
 * ne doit jamais en dépendre. Sans dépendance à Next (jeu d'essai
 * `scripts/essai-correction.ts`) ; ne jamais l'importer dans un composant
 * client : il lit ANTHROPIC_API_KEY.
 */

export const MODELE = "claude-haiku-5-5";
/** Au-delà, on envoie sans correction (médiane mesurée 2,5 s, textes très fautifs 7-8 s). */
export const DELAI_MS = Number(process.env.CORRECTION_DELAI_MS) || 8000;

const CONSIGNE = `Tu es correcteur d'orthographe pour Co-Aut, un site où des enfants et des adultes écrivent des histoires à plusieurs, chacun son tour.

Ta seule mission : relever les fautes d'orthographe et de grammaire du texte, pour que l'auteur les corrige d'un geste. Tu ne réécris jamais le texte.

Ce que tu relèves :
- orthographe : mot mal écrit (bocou → beaucoup, otomobile → automobile, gateau → gâteau).
- accord : genre et nombre (les enfant → les enfants, une petit fille → une petite fille).
- conjugaison : terminaison du verbe (ils mange → ils mangent, il a manger → il a mangé).
- homophone : a/à, et/est, son/sont, ses/ces, sa/ça, on/ont, ou/où, ce/se, la/là, peu/peut.
- ponctuation : seulement le point oublié en fin de texte, l'apostrophe oubliée (c est → c'est).
- majuscule : seulement en début de phrase.

Ce que tu ne fais jamais :
- reformuler, changer un mot pour un autre, proposer un synonyme, « améliorer » le style ;
- ajouter ou supprimer des mots ou des phrases ; corriger une répétition, une tournure maladroite, un registre familier ou une phrase un peu longue : c'est la voix de l'auteur, souvent un enfant, elle doit rester intacte ;
- toucher aux noms de personnages et de lieux, aux mots inventés, aux onomatopées (boum, splatch, aaaah), au langage parlé voulu dans les dialogues, aux mots de la liste « vocabulaire du livre » ;
- corriger ce qui n'est pas une faute certaine. Dans le doute, abstiens-toi.

Pour chaque faute, donne :
- "extrait" : 3 à 6 mots copiés exactement du texte (mêmes lettres, accents, majuscules et ponctuation) qui contiennent la faute, pour la situer ;
- "fautif" : le passage fautif exact tel qu'il est écrit, un mot, deux au plus ;
- "correction" : la bonne graphie de ce même passage, rien de plus ;
- "type" : orthographe, accord, conjugaison, homophone, ponctuation ou majuscule.

Ne relève jamais un passage déjà correct (correction identique au passage fautif). Si une même faute revient à plusieurs endroits, donne-la à chaque endroit, avec un extrait différent. S'il n'y a aucune faute, renvoie une liste vide.`;

const SCHEMA = {
  type: "object",
  properties: {
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          extrait: { type: "string" },
          fautif: { type: "string" },
          correction: { type: "string" },
          type: { type: "string", enum: [...TYPES_CORRECTION] },
        },
        required: ["extrait", "fautif", "correction", "type"],
        additionalProperties: false,
      },
    },
  },
  required: ["corrections"],
  additionalProperties: false,
} as const;

let client: Anthropic | null = null;

export type ResultatIA = {
  propositions: Proposition[];
  /** Jetons consommés (suivi du coût). */
  usage: { entree: number; sortie: number };
  dureeMs: number;
};

export async function demanderCorrections(
  texte: string,
  vocabulaire: string[] = []
): Promise<ResultatIA | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: DELAI_MS, maxRetries: 0 });
  const debut = Date.now();
  const contenu =
    (vocabulaire.length
      ? `<vocabulaire_du_livre>\n${vocabulaire.join(", ")}\n</vocabulaire_du_livre>\n\n`
      : "") + `<texte>\n${texte}\n</texte>`;
  try {
    const reponse = await client.messages.create(
      {
        model: MODELE,
        max_tokens: 8000,
        // Réflexion adaptative au plus bas : nettement plus juste que sans
        // réflexion (jusque-là, ses/ces, participes), pour ~2,5 s de médiane.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SCHEMA },
        },
        system: CONSIGNE,
        messages: [{ role: "user", content: contenu }],
      },
      { signal: AbortSignal.timeout(DELAI_MS) }
    );
    if (reponse.stop_reason !== "end_turn") return null;
    const bloc = reponse.content.find((b) => b.type === "text");
    if (!bloc || bloc.type !== "text") return null;
    const json = JSON.parse(bloc.text) as { corrections?: Proposition[] };
    if (!Array.isArray(json.corrections)) return null;
    return {
      propositions: json.corrections,
      usage: {
        entree: reponse.usage.input_tokens,
        sortie: reponse.usage.output_tokens,
      },
      dureeMs: Date.now() - debut,
    };
  } catch (e) {
    console.warn(
      `[correction] envoi sans correction (${Date.now() - debut} ms) :`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}
