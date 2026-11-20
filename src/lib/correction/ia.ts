import Anthropic from "@anthropic-ai/sdk";
import { TYPES_CORRECTION, type Proposition } from "./filtre.ts";

/**
 * Appel à Claude : liste des fautes d'un texte, jamais le texte lui-même.
 * Renvoie null si l'IA ne répond pas à temps ou en erreur : l'envoi du tour
 * ne doit jamais en dépendre. Sans dépendance à Next (jeu d'essai
 * `scripts/essai-correction.ts`) ; ne jamais l'importer dans un composant
 * client : il lit ANTHROPIC_API_KEY.
 */

/**
 * Mesuré le 20/11 sur deux tours de la cliente (276 et 1 493 caractères) : Haiku 5.5 laissait
 * passer des accords (« ne l'encourage pas ») et mettait 6-15 s ; Sonnet 5.5 en effort `low`
 * 2-5 s mais manque encore « s'il ne sont » une fois sur deux ; Opus 5.5 en effort `low`
 * 3-6 s, tout relevé. Coût : ~1,3 centime pour un tour court, ~5 centimes pour 1 500 caractères.
 */
export const MODELE = process.env.CORRECTION_MODELE || "claude-opus-5-5";
const EFFORT = (process.env.CORRECTION_EFFORT || "low") as "low" | "medium" | "high";
/**
 * Délai d'un appel (un morceau de texte, les morceaux partent en parallèle). Au-delà, on envoie
 * sans correction. Le 19/11, 8 s coupaient tous les longs textes : rien n'était proposé.
 */
export const DELAI_MS = Number(process.env.CORRECTION_DELAI_MS) || 25000;

const CONSIGNE = `Tu es correcteur d'orthographe et de grammaire pour Co-Aut, un site où des enfants et des adultes écrivent des histoires à plusieurs, chacun son tour.

Ta mission : relever TOUTES les fautes d'orthographe, de grammaire et de typographie du texte, pour que l'auteur les corrige d'un geste. Tu ne réécris jamais le texte. Les textes d'enfants peuvent contenir des dizaines de fautes : relève-les toutes, sans t'arrêter aux plus visibles.

Méthode : relis le texte phrase par phrase. Dans chaque phrase, vérifie chaque mot (orthographe, accents), chaque accord (déterminant-nom-adjectif, sujet-verbe, participe passé), chaque homophone, puis les espaces autour de la ponctuation.

Ce que tu relèves :
- orthographe : mot mal écrit, accent oublié ou faux, lettre en trop (bocou → beaucoup, gateau → gâteau, voila → voilà, maisson → maison).
- accord : genre et nombre, y compris l'adjectif et le participe passé (les enfant → les enfants, une petit fille → une petite fille, la lettre qu'il a écrit → écrite, qu'il ne soient → qu'ils ne soient).
- conjugaison : terminaison du verbe, impératif, infinitif ou participe (ils mange → ils mangent, il a manger → il a mangé, attend ! → attends !, peut-tu → peux-tu).
- homophone : a/à, et/est, son/sont, ses/ces/c'est/s'est, sa/ça, on/ont, ou/où, ce/se, la/là/l'a, peu/peut, quel/qu'elle, leur/leurs, mes/mais. Exemple : « c'est amis ne le croit pas » → « ses amis ne le croient pas » (c'est amis → ses amis, croit → croient).
- ponctuation : espace oubliée après une virgule ou un point (enfin,il → enfin, il ; partit.Le → partit. Le), point oublié en fin de texte, apostrophe oubliée (c est → c'est), ponctuation doublée par erreur (Merci ! . → Merci !).
- trait d'union : à l'impératif et dans l'inversion (regarde moi → regarde-moi, prends là → prends-la), pas de trait d'union en trop (est-ce-que → est-ce que, je-sais → je sais) ; classe ces fautes en « ponctuation ».
- majuscule : en début de phrase seulement.

Ce que tu ne fais jamais :
- reformuler, changer un mot pour un autre, proposer un synonyme, « améliorer » le style ;
- ajouter ou supprimer des mots ou des phrases ; corriger une répétition, une tournure maladroite, un registre familier, une négation sans « ne » dans un dialogue (c'est pas), une phrase un peu longue : c'est la voix de l'auteur, souvent un enfant, elle doit rester intacte ;
- changer la présentation des dialogues (tirets, guillemets, retours à la ligne) ;
- toucher aux noms de personnages et de lieux, aux mots inventés, aux onomatopées (boum, splatch, aaaah), au langage parlé voulu dans les dialogues (ouais, bah, ch'uis), aux mots de la liste « vocabulaire du livre ».

Une faute certaine se corrige toujours, même si le texte en compte beaucoup. Seul ce qui relève du style ou du choix de l'auteur reste intact.

Pour chaque faute, donne :
- "extrait" : 3 à 6 mots copiés exactement du texte (mêmes lettres, accents, majuscules et ponctuation) qui contiennent la faute, pour la situer ;
- "fautif" : le passage fautif exact tel qu'il est écrit, un mot, deux au plus (avec la ponctuation concernée pour une faute d'espace ou de trait d'union) ;
- "correction" : la bonne graphie de ce même passage, rien de plus ;
- "type" : orthographe, accord, conjugaison, homophone, ponctuation ou majuscule.

Quand deux mots voisins sont fautifs (c'est amis → ses amis), donne-les ensemble dans une seule proposition. Ne relève jamais un passage déjà correct (correction identique au passage fautif). Si une même faute revient à plusieurs endroits, donne-la à chaque endroit, avec un extrait différent. S'il n'y a aucune faute, renvoie une liste vide.`;

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
        max_tokens: 16000,
        // Réflexion adaptative (toujours active sur Opus 5.5), effort explicite :
        // le défaut du modèle est `medium`, plus lent sans gain mesuré ici.
        output_config: {
          effort: EFFORT,
          format: { type: "json_schema", schema: SCHEMA },
        },
        system: CONSIGNE,
        messages: [{ role: "user", content: contenu }],
      },
      { signal: AbortSignal.timeout(DELAI_MS) }
    );
    if (reponse.stop_reason !== "end_turn") {
      console.warn(`[correction] réponse incomplète (${reponse.stop_reason})`);
      return null;
    }
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
