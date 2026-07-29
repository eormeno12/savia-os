import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/invitar", "/favicon.ico", "/_next", "/api", "/hero"];

/**
 * Auth gate + root redirect. Next 16 renamed the `middleware` file convention to
 * `proxy` (same API surface); this replaces `middleware.ts`.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Mock mode (NEXT_PUBLIC_MOCK=1): there's no real backend/cookie, so the auth
  // gate would bounce everything to /login. Let every route through and keep
  // only the root→/memoria convenience redirect.
  if (process.env.NEXT_PUBLIC_MOCK === '1') {
    if (pathname === '/') {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = '/memoria';
      return NextResponse.redirect(homeUrl);
    }
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    /\.(?:png|jpe?g|svg|webp|ico|gif)$/i.test(pathname);
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // redirect root to the memory home
  if (pathname === "/") {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/memoria";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
