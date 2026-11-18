import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Chemins réservés aux utilisateurs connectés. */
const PROTECTED_PREFIXES = ["/books", "/bibliotheque", "/profil", "/classes", "/admin"];

/** Pages sans objet pour un élève (il garde l'accès à /books/<livre> pour lire et écrire). */
function isAdultOnly(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/books" ||
    ["/books/new", "/books/mes-livres", "/bibliotheque", "/profil", "/classes"].some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    )
  );
}

/** Rafraîchit la session Supabase (cookies) et protège les pages de l'app. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?mode=login";
    return NextResponse.redirect(url);
  }

  // Élève (compte technique d'une classe) : ses livres de classe et rien d'autre. La RLS le garantit
  // en base ; ici on lui évite simplement des pages vides.
  if (user?.app_metadata?.coaut_kind === "student" && isAdultOnly(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/classe/livres";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Garder les cookies de session éventuellement rafraîchis à l'instant.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
