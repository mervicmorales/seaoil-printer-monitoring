import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/validation";

const PUBLIC_PATHS = ["/login", "/access-denied"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/monitoring/ingest") ||
    pathname.startsWith("/api/monitoring/config") ||
    pathname.startsWith("/api/monitoring/discovery") ||
    pathname.startsWith("/api/monitoring/printops") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
