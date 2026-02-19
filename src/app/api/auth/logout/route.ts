import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { clearAuthCookie, COOKIE_NAME } from "../../../../lib/auth/cookies";
import { destroySession } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;

  await destroySession(token);
  await clearAuthCookie();

  return NextResponse.redirect(new URL("/auth/login", request.url));
}
