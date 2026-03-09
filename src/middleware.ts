import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware for canonical URL enforcement:
 * - Remove trailing slashes (except root /)
 * - Redirect www to non-www
 * - Enforce lowercase paths for SEO routes
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Remove trailing slash (canonical enforcement) except root
  if (pathname !== "/" && pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(0, -1);
    return NextResponse.redirect(url, 301);
  }

  // 2. Enforce lowercase for SEO-critical public paths
  if (/^\/(?:events|e)\//.test(pathname) && pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all paths except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|sw.js|manifest.webmanifest|api/).*)",
  ],
};
