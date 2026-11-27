/**
 * Filtrage de ce qui part vers GlitchTip (collecteur d'erreurs compatible Sentry de l'agence).
 * Pur (aucune dépendance au SDK à l'exécution) : testé par `filtre.test.ts`, `npm test`.
 *
 * Co-Aut a des auteurs mineurs : rien ne doit partir qui identifie une personne ou reprenne ce
 * qu'elle a écrit. Seuls restent l'id de la fiche auteur et le rôle (posés par `setReportedUser`).
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Paramètres d'URL dont la valeur ouvre un compte ou une session : `token_hash` (liens des mails
 * de confirmation et de mot de passe oublié, /auth/confirm et /nouveau-mot-de-passe), `token`,
 * `code` (échange PKCE), jetons Supabase d'un éventuel fragment `#access_token=…`.
 */
const SECRET_PARAMS = ["token_hash", "token", "code", "access_token", "refresh_token"];

/** Paramètres retirés entièrement : `q` = ce que l'utilisateur cherche (listes de livres, admin). */
const DROPPED_PARAMS = ["q"];

const SECRET_RE = new RegExp(`([?&#](?:${SECRET_PARAMS.join("|")})=)[^&#]*`, "g");
const DROPPED_RE = new RegExp(`([?&])(?:${DROPPED_PARAMS.join("|")})=[^&#]*&?`);

/** Masque les paramètres secrets et retire la recherche d'une URL, relative ou absolue. */
export function scrubUrl(url: string): string {
  let out = url.replace(SECRET_RE, "$1[filtré]");
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(DROPPED_RE, "$1");
  }
  // « ?» ou « &» resté en fin de query string après un retrait.
  return out.replace(/[?&](?=#|$)/, "");
}

/** Appel à l'API Supabase (PostgREST, GoTrue, Kong) : la query string porte les filtres et les valeurs. */
function isSupabaseApi(url: string): boolean {
  return /\/(?:rest|auth|storage|realtime|functions)\/v1\//.test(url);
}

/** URL d'un appel réseau : chemin seul pour Supabase, sinon paramètres filtrés. */
export function scrubRequestUrl(url: string): string {
  if (isSupabaseApi(url)) return url.split(/[?#]/)[0];
  return scrubUrl(url);
}

/** En-têtes gardés sur un événement (les cookies portent la session Supabase). */
const KEPT_HEADERS = ["user-agent"];

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const req = event.request;
  if (req) {
    if (typeof req.url === "string") req.url = scrubUrl(req.url);
    delete req.cookies;
    delete req.data;
    delete req.query_string;
    delete req.env;
    if (req.headers) {
      const kept: Record<string, string> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        if (KEPT_HEADERS.includes(name.toLowerCase())) kept[name] = value;
      }
      req.headers = kept;
    }
  }

  // Contexte posé par onRequestError (chemin de la requête, avec sa query string).
  const nextjs = event.contexts?.nextjs as Record<string, unknown> | undefined;
  if (nextjs && typeof nextjs.request_path === "string") {
    nextjs.request_path = scrubUrl(nextjs.request_path);
  }

  if (event.user) {
    const { id, role } = event.user as { id?: string | number; role?: string };
    event.user = { ...(id !== undefined ? { id } : {}), ...(role ? { role } : {}) } as ErrorEvent["user"];
  }
  delete event.server_name;

  // Variables locales des fonctions (texte d'un tour, jetons…) : jamais.
  for (const ex of event.exception?.values ?? []) {
    for (const frame of ex.stacktrace?.frames ?? []) delete frame.vars;
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }
  return event;
}

/**
 * Fil d'Ariane : pas de console (les messages peuvent reprendre un texte saisi), URL filtrées,
 * appels Supabase réduits au chemin. Jamais de corps de requête (le SDK n'en met pas, on retire
 * quand même ce qui y ressemblerait).
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  const data = breadcrumb.data;
  if (data) {
    const network =
      breadcrumb.category === "fetch" ||
      breadcrumb.category === "xhr" ||
      breadcrumb.category === "http" ||
      breadcrumb.type === "http";
    if (network && typeof data.url === "string") data.url = scrubRequestUrl(data.url);
    for (const key of ["from", "to", "url"]) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key]);
    }
    for (const key of ["http.query", "http.fragment", "body", "request_body", "response_body"]) {
      delete data[key];
    }
  }
  if (typeof breadcrumb.message === "string" && breadcrumb.category === "navigation") {
    breadcrumb.message = scrubUrl(breadcrumb.message);
  }
  return breadcrumb;
}
