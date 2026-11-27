/**
 * Retours des actions d'administration : l'action redirige avec ?ok=<code>&n=<nombre> ou
 * ?erreur=<code>, la page affiche le texte correspondant. Seuls ces textes peuvent s'afficher.
 */

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const OK_MESSAGES: Record<string, (n: number) => string> = {
  archive: (n) => `${n} ${plural(n, "livre archivé", "livres archivés")}.`,
  relance: (n) => `${n} ${plural(n, "livre remis", "livres remis")} en cours.`,
  publie: (n) => `${n} ${plural(n, "livre publié", "livres publiés")}.`,
  livre_supprime: (n) => `${n} ${plural(n, "livre supprimé", "livres supprimés")}.`,
  livre_modifie: () => "Livre enregistré.",
  max_joueurs: () => "Nombre de co-auteurs enregistré.",
  coauteur_retire: () => "Co-auteur retiré de l'équipe.",
  coauteur_ajoute: () => "Co-auteur ajouté à l'équipe.",
  tour_passe: () => "Le tour est passé à l'auteur suivant.",
  lanceur_change: () =>
    "Nouveau lanceur enregistré : c'est lui qui reçoit maintenant les demandes pour rejoindre le livre.",
  bloque: (n) => `${n} ${plural(n, "auteur bloqué", "auteurs bloqués")}.`,
  debloque: (n) => `${n} ${plural(n, "auteur débloqué", "auteurs débloqués")}.`,
  auteur_supprime: (n) => `${n} ${plural(n, "auteur supprimé", "auteurs supprimés")}. Leurs tours restent, anonymisés.`,
  pseudo: () => "Pseudo enregistré.",
  note: () => "Note enregistrée.",
  email: () => "Adresse mail changée : l'auteur se connecte maintenant avec la nouvelle adresse.",
  profil: () => "Informations enregistrées.",
  tour_modifie: () => "Texte du tour enregistré.",
  classe_bloquee: (n) =>
    `${n} ${plural(n, "classe bloquée", "classes bloquées")} : ses élèves ne peuvent plus entrer ni écrire.`,
  classe_debloquee: (n) => `${n} ${plural(n, "classe débloquée", "classes débloquées")}.`,
  classe_supprimee: (n) => `${n} ${plural(n, "classe supprimée", "classes supprimées")}.`,
  tour_supprime: (n) => `${n} ${plural(n, "tour supprimé", "tours supprimés")}. Les suivants sont renumérotés.`,
};

export const ERROR_MESSAGES: Record<string, string> = {
  selection: "Coche au moins une ligne.",
  action: "Choisis une action.",
  introuvable: "Élément introuvable : il a peut-être déjà été supprimé.",
  titre: "Le titre doit faire au moins 3 caractères.",
  max_joueurs: "Le nombre de co-auteurs doit être entre 1 et 30, et pas moins que l'équipe actuelle.",
  equipe_seule: "Il faut au moins deux co-auteurs pour passer le tour.",
  pas_en_cours: "Ce livre n'est pas en cours d'écriture.",
  auteur_inconnu: "Aucun auteur ne porte ce pseudo.",
  deja_equipe: "Cet auteur fait déjà partie de l'équipe.",
  deja_lanceur: "Cet auteur est déjà le lanceur du livre.",
  lanceur_hors_equipe: "Le nouveau lanceur doit faire partie de l'équipe : ajoute-le d'abord.",
  lanceur_classe: "Le lanceur d'un livre de classe est son prof : il ne se change pas.",
  pas_de_fiche: "Ton compte n'a pas de fiche auteur.",
  publier_vide: "Impossible de publier un livre sans aucun tour écrit.",
  pseudo_court: "Le pseudo doit faire entre 3 et 40 caractères.",
  pseudo_pris: "Ce pseudo est déjà pris par un autre auteur : choisis-en un autre.",
  email_format: "Cette adresse mail n'est pas valide. Vérifie-la (exemple : prenom@domaine.fr).",
  email_pris: "Cette adresse mail est déjà utilisée par un autre compte.",
  sans_compte: "Cet auteur n'a pas de compte de connexion : il n'y a pas d'adresse à changer.",
  email_eleve: "Un élève se connecte avec le code de sa classe : son compte n'a pas d'adresse mail.",
  date_naissance: "Cette date de naissance n'est pas valide (âge entre 5 et 110 ans).",
  soi_meme: "Tu ne peux pas bloquer ni supprimer ton propre compte.",
  admin: "C'est un compte administrateur : il ne peut être ni bloqué ni supprimé d'ici.",
  supprime: "Cet auteur a été supprimé.",
  texte_vide: "Le texte du tour ne peut pas être vide.",
  technique: "L'opération a échoué. Réessaie, et préviens Turing si ça continue.",
};

export function noticeFrom(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const ok = one("ok");
  const err = one("erreur");
  const n = Number(one("n") ?? 1) || 1;
  return {
    info: ok && OK_MESSAGES[ok] ? OK_MESSAGES[ok](n) : undefined,
    error: err && ERROR_MESSAGES[err] ? ERROR_MESSAGES[err] : undefined,
  };
}
