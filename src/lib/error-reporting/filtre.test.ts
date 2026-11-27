import { test } from "node:test";
import assert from "node:assert/strict";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent, scrubRequestUrl, scrubUrl } from "./filtre.ts";

test("le jeton des liens de mail est masqué, en URL absolue comme relative", () => {
  assert.equal(
    scrubUrl("https://app.co-aut.com/auth/confirm?token_hash=abc123&type=recovery"),
    "https://app.co-aut.com/auth/confirm?token_hash=[filtré]&type=recovery",
  );
  assert.equal(
    scrubUrl("/nouveau-mot-de-passe?token_hash=pkce_abc-123"),
    "/nouveau-mot-de-passe?token_hash=[filtré]",
  );
  assert.equal(scrubUrl("/auth/callback?code=xyz&next=/books"), "/auth/callback?code=[filtré]&next=/books");
  assert.equal(
    scrubUrl("/#access_token=eyJ.a.b&refresh_token=r1&type=recovery"),
    "/#access_token=[filtré]&refresh_token=[filtré]&type=recovery",
  );
});

test("la recherche (q) est retirée, les autres paramètres restent", () => {
  assert.equal(scrubUrl("/books?q=dragon"), "/books");
  assert.equal(scrubUrl("/books?q=dragon&theme=Aventure"), "/books?theme=Aventure");
  assert.equal(scrubUrl("/admin/auteurs?page=2&q=lea%40mail.fr"), "/admin/auteurs?page=2");
  assert.equal(scrubUrl("/admin/livres?a=1&q=x&b=2"), "/admin/livres?a=1&b=2");
  assert.equal(scrubUrl("/books?quete=1&tokens=x"), "/books?quete=1&tokens=x");
});

test("un appel à l'API Supabase ne garde que son chemin", () => {
  assert.equal(
    scrubRequestUrl("http://kong:8000/rest/v1/turns?select=*&text=eq.Il%20etait%20une%20fois"),
    "http://kong:8000/rest/v1/turns",
  );
  assert.equal(scrubRequestUrl("http://kong:8000/auth/v1/verify?token=abc"), "http://kong:8000/auth/v1/verify");
  assert.equal(scrubRequestUrl("/api/brouillon"), "/api/brouillon");
});

test("événement : URL, en-têtes, cookies, corps et utilisateur nettoyés", () => {
  const event = {
    request: {
      url: "https://app.co-aut.com/nouveau-mot-de-passe?token_hash=secret",
      headers: { Cookie: "sb-access-token=xyz", "User-Agent": "Firefox", Referer: "https://x/?token=a" },
      cookies: { "sb-access-token": "xyz" },
      data: "Il était une fois…",
      query_string: "token_hash=secret",
    },
    contexts: { nextjs: { request_path: "/auth/confirm?token_hash=secret&type=email" } },
    user: { id: "a1", role: "student", email: "eleve@x.fr", username: "Léa", ip_address: "1.2.3.4" },
    server_name: "coaut-app",
    exception: { values: [{ type: "Error", stacktrace: { frames: [{ function: "saveTurn", vars: { text: "Il était une fois" } }] } }] },
    breadcrumbs: [
      { category: "console", message: "texte du tour" },
      { category: "navigation", data: { from: "/books?q=lea", to: "/books/052" } },
    ],
  } as unknown as ErrorEvent;

  const out = scrubEvent(event);
  assert.equal(out.request?.url, "https://app.co-aut.com/nouveau-mot-de-passe?token_hash=[filtré]");
  assert.deepEqual(out.request?.headers, { "User-Agent": "Firefox" });
  assert.equal(out.request?.cookies, undefined);
  assert.equal(out.request?.data, undefined);
  assert.equal(out.request?.query_string, undefined);
  assert.equal(
    (out.contexts?.nextjs as { request_path: string }).request_path,
    "/auth/confirm?token_hash=[filtré]&type=email",
  );
  assert.deepEqual(out.user, { id: "a1", role: "student" });
  assert.equal(out.server_name, undefined);
  assert.equal(out.exception?.values?.[0].stacktrace?.frames?.[0].vars, undefined);
  assert.equal(out.breadcrumbs?.length, 1);
  assert.deepEqual(out.breadcrumbs?.[0].data, { from: "/books", to: "/books/052" });
});

test("fil d'Ariane : console écartée, requêtes réseau filtrées", () => {
  assert.equal(scrubBreadcrumb({ category: "console", message: "x" }), null);
  const http = scrubBreadcrumb({
    category: "http",
    type: "http",
    data: {
      url: "http://kong:8000/rest/v1/authors?nickname=eq.Lea",
      "http.query": "?nickname=eq.Lea",
      "http.fragment": "",
      "http.method": "GET",
    },
  } as Breadcrumb);
  assert.deepEqual(http?.data, { url: "http://kong:8000/rest/v1/authors", "http.method": "GET" });
  const fetchCrumb = scrubBreadcrumb({
    category: "fetch",
    data: { url: "/auth/confirm?token_hash=abc&type=email", method: "GET" },
  });
  assert.equal(fetchCrumb?.data?.url, "/auth/confirm?token_hash=[filtré]&type=email");
});
