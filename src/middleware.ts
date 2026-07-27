import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Serve the single pre-built /campaign/_/ shell for every public campaign slug.
 * The client reads the real slug from window.location.pathname and fetches live data.
 * Mirrors public/.htaccess (static Hostinger) for Amplify SSR / next dev.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/campaign\/([^/]+)\/?$/);
  if (match && match[1] !== "_") {
    const url = request.nextUrl.clone();
    url.pathname = "/campaign/_/";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/campaign/:path*"],
};
