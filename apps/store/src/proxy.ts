import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets and Next.js internal routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") || "";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  const hostNoPort = host.split(":")[0];
  const rootNoPort = rootDomain.split(":")[0];

  const isRootDomain =
    host === rootDomain ||
    host === "localhost:3000" ||
    host === "127.0.0.1:3000" ||
    (hostNoPort === rootNoPort && hostNoPort === "localhost") ||
    (hostNoPort === rootNoPort && hostNoPort === "127.0.0.1");

  const url = request.nextUrl.clone();

  if (isRootDomain) {
    if (pathname.startsWith("/saas-landing")) {
      return NextResponse.next();
    }
    url.pathname = `/saas-landing${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  } else {
    if (pathname.startsWith("/tenant")) {
      return NextResponse.next();
    }
    url.pathname = `/tenant${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
