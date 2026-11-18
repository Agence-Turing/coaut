/**
 * Repérage des coordonnées par le code (premier étage de la modération, sans IA, instantané).
 *
 * Fichier sans dépendance (ni Next, ni Supabase) : il est importé côté serveur et testé
 * directement par `node --test` (contacts.test.ts).
 *
 * Règle : on ne bloque que ce qui ne peut pas être une phrase d'histoire. Le reste
 * (numéro écrit en lettres, « retrouve-moi sur… » sans pseudo, adresse déguisée) est laissé
 * à la lecture par l'IA, deuxième étage.
 */

export type ContactKind = "lien" | "email" | "telephone" | "reseau";

export type ContactHit = {
  kind: ContactKind;
  /** Extrait repéré, tel qu'écrit par l'auteur (montré dans le message d'erreur). */
  match: string;
};

/**
 * Réseaux et messageries. Le nom seul est permis (« un message WhatsApp de sa mère ») ; seuls les
 * noms sans autre sens en français sont listés (pas « signal », « line », « threads »).
 */
const PLATFORMS =
  "snap(?:chat)?|insta(?:gram)?|whats?app|discord|tik ?tok|telegram|facebook|fb|messenger|twitter|twitch|skype|kik|wechat|bereal|roblox|fortnite|psn|xbox";

/**
 * Domaines de premier niveau pour un domaine nu, en minuscules. Volontairement courte : une
 * phrase collée après un point (« il était là.me voilà », « fini.de rire ») ne doit pas passer
 * pour un lien. Les liens complets (http://, www.) sont repérés quel que soit le domaine.
 */
const TLDS = "com|fr|net|org|io|gg|ly|xyz|biz|ru|uk|online|shop|store";

const URL_EXPLICIT = /\b(?:https?:\/\/|www\.)[^\s<>"«»]+/i;
/** Domaine nu : « monsite.fr », « bit.ly/abc ». Étiquette d'au moins 2 caractères, TLD en minuscules. */
const URL_BARE = new RegExp(
  `(?<![\\w@.])[A-Za-z0-9][A-Za-z0-9-]{1,62}(?:\\.[A-Za-z0-9-]{2,62})*\\.(?:${TLDS})(?![\\p{L}\\p{N}_-])(?:\\/[^\\s]*)?`,
  "u"
);

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[a-z]{2,}/iu;
/** Adresse déguisée avec espaces : « lea @ gmail », « lea arobase hotmail ». */
const EMAIL_SPACED =
  /[\p{L}\p{N}._-]+\s*(?:@|\(at\)|\[at\]|arobase|arrobase)\s*(?:gmail|hotmail|yahoo|outlook|icloud|orange|free|sfr|laposte|live|msn|proton(?:mail)?|wanadoo|bbox|aol|gmx)\b/iu;

/** Numéro français : 06 12 34 56 78, 06.12.34.56.78, 0612345678, 06-12-34-56-78. */
const PHONE_FR = /(?<!\d)0[1-9](?:[ .\-]?\d{2}){4}(?!\d)/;
/** International : +33 6 12 34 56 78, 0033612345678, +1 (555) 123-4567, +44 20 7946 0958. */
const PHONE_INTL = /(?:\+|(?<!\d)00)[1-9]\d{0,2}(?:[ .\-]?\(?\d+\)?){2,7}/;
/** Toute suite d'au moins 9 chiffres séparés au plus par un espace, un point ou un tiret. */
const DIGIT_RUN = /\d(?:[ .\-]?\d){8,}/g;

/** Mention d'un réseau suivie d'un identifiant : « snap : lea.2012 », « insta @lea_d ». */
const PLATFORM_WITH_ID = new RegExp(
  `\\b(?:${PLATFORMS})\\b\\s*(?:[:=]|->|→)\\s*@?[\\p{L}\\p{N}._-]{3,}` +
    `|\\b(?:${PLATFORMS})\\b[^\\S\\n]*(?:(?:c'?est|c’est|est|perso|pseudo|id|compte|moi|me|sur|chez|de)[^\\S\\n]+){0,3}` +
    `@?(?=[\\p{L}\\p{N}._-]*[\\d_.@])(?=[\\p{L}\\p{N}._-]*\\p{L})[\\p{L}\\p{N}._-]{3,}(?<![.])`,
  "iu"
);
/** Pseudo isolé : « @lea_2012 » (l'adresse e-mail, sans espace avant @, est traitée plus haut). */
const AT_HANDLE = /(?:^|[\s(«"'’])@[\p{L}\p{N}._]{3,}/u;
/** Identifiant Discord historique : « lea#1234 ». */
const DISCORD_TAG = /[\p{L}\p{N}._]{2,}#\d{4}\b/u;

/** Mots-nombres : un numéro dicté en lettres (« zéro six douze trente-quatre… »). */
const NUMBER_WORDS = new Set(
  (
    "zero zéro un une deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize " +
    "vingt trente quarante cinquante soixante septante huitante nonante cent et"
  ).split(" ")
);

function spelledNumber(text: string): string | null {
  // Découpe en mots en gardant les traits d'union comme séparateurs (« trente-quatre »).
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== "zéro" && words[i] !== "zero") continue;
    let j = i + 1;
    while (j < words.length && NUMBER_WORDS.has(words[j])) j++;
    // « zéro » + au moins 5 mots-nombres : forme d'un numéro dicté (06 12 34 56 78).
    if (j - i >= 6) return words.slice(i, j).join(" ");
  }
  return null;
}

/** Grand nombre écrit à la française (« 1 000 000 000 ») : ce n'est pas un numéro. */
function isFormattedQuantity(run: string): boolean {
  return /^\d{1,3}(?:[ .]\d{3})+$/.test(run.trim());
}

/** Compte à voix haute (« 1 2 3 4 5 6 7 8 9 10 ») : suite d'entiers consécutifs, pas un numéro. */
function isCounting(run: string): boolean {
  const groups = run.split(/[ .\-]/).filter(Boolean).map(Number);
  if (groups.length < 4) return false;
  return groups.every((n, i) => i === 0 || n === groups[i - 1] + 1 || n === groups[i - 1] - 1);
}

/** Renvoie la première coordonnée trouvée, ou null si le texte est propre. */
export function findContact(text: string): ContactHit | null {
  const t = text.normalize("NFC");

  const email = t.match(EMAIL) ?? t.match(EMAIL_SPACED);
  if (email) return { kind: "email", match: email[0] };

  const url = t.match(URL_EXPLICIT) ?? t.match(URL_BARE);
  if (url) return { kind: "lien", match: url[0] };

  const phone = t.match(PHONE_FR) ?? t.match(PHONE_INTL);
  if (phone && phone[0].replace(/\D/g, "").length >= 8) {
    return { kind: "telephone", match: phone[0].trim() };
  }
  for (const m of t.matchAll(DIGIT_RUN)) {
    if (!isFormattedQuantity(m[0]) && !isCounting(m[0])) return { kind: "telephone", match: m[0] };
  }
  const spelled = spelledNumber(t);
  if (spelled) return { kind: "telephone", match: spelled };

  const social =
    t.match(PLATFORM_WITH_ID) ?? t.match(DISCORD_TAG);
  if (social) return { kind: "reseau", match: social[0].trim() };
  const handle = t.match(AT_HANDLE);
  if (handle) return { kind: "reseau", match: handle[0].trim() };

  return null;
}
