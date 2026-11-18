import type { AiCategory, TextKind } from "./ai";
import type { ContactKind } from "./contacts";

export type BlockCategory = Exclude<AiCategory, "aucune">;

const CONTACT_LABEL: Record<ContactKind, string> = {
  lien: "un lien",
  email: "une adresse e-mail",
  telephone: "un numéro de téléphone",
  reseau: "un pseudo de réseau social",
};

/** Message montré à l'auteur quand le repérage par le code a trouvé une coordonnée. */
export function contactMessage(kind: ContactKind, match: string): string {
  const extract = match.length > 60 ? `${match.slice(0, 57)}…` : match;
  return `Ton texte contient ${CONTACT_LABEL[kind]} (« ${extract} ») : sur Co-Aut on ne partage ni e-mail, ni numéro, ni lien, ni réseau social. Modifie-le pour l'envoyer.`;
}

const OFF_TOPIC: Record<TextKind, string> = {
  turn: "Ton texte ne ressemble pas à la suite de l'histoire. Écris ce qui arrive ensuite aux personnages pour l'envoyer.",
  join_request:
    "Ton message ne parle ni de toi, ni de ce livre. Présente-toi au lanceur et dis-lui ce qui te plaît dans son histoire pour l'envoyer.",
  book: "Ton titre ou ton résumé ne ressemble pas à la présentation d'une histoire. Raconte de quoi parlera ton livre pour le lancer.",
};

/** Message doux et précis selon la catégorie retenue par l'IA. */
export function categoryMessage(category: BlockCategory, kind: TextKind): string {
  switch (category) {
    case "coordonnees":
      return "Ton texte semble donner un moyen de se contacter en dehors de Co-Aut (numéro, adresse, réseau social, rendez-vous). Sur Co-Aut, on ne partage pas ses coordonnées. Modifie-le pour l'envoyer.";
    case "insulte":
      return "Ton texte semble viser une vraie personne. Tes personnages peuvent se disputer, mais on ne s'en prend ni aux autres auteurs, ni à des gens réels. Modifie-le pour l'envoyer.";
    case "sexuel":
      return "Ton texte contient des passages qui ne conviennent pas à Co-Aut, où écrivent aussi des enfants. Modifie-le pour l'envoyer.";
    case "malsain":
      return "Ton texte contient des passages trop durs ou dangereux pour Co-Aut. Si quelque chose te pèse, parles-en à un adulte de confiance. Modifie-le pour l'envoyer.";
    case "spam":
      return "Ton texte ressemble à de la publicité ou à un message répété. Modifie-le pour l'envoyer.";
    case "hors_sujet":
      return OFF_TOPIC[kind];
  }
}
