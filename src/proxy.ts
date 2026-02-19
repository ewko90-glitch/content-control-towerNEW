import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_NAME } from "./lib/auth/constants";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/overview") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/w/") ||
    pathname.startsWith("/account")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const checkUrl = new URL("/api/auth/session-check", request.url);
  const checkResponse = await fetch(checkUrl, {
    method: "GET",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });

  if (!checkResponse.ok) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/onboarding/:path*", "/w/:path*", "/account/:path*"],
};