import { NextRequest, NextResponse } from "next/server";

const MOCK_COOKIE = "mock_admin_session";

/**
 * Gate all /admin/* routes behind the mock sign-in page. Any value for the
 * cookie counts as "signed in" for the take-home demo. API routes under
 * /api/admin/* keep their own Bearer-token guard (requireAdmin) and are not
 * affected by this middleware.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const cookie = req.cookies.get(MOCK_COOKIE)?.value;
  if (cookie) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
