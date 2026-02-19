import { NextResponse } from "next/server";

import { setAuthCookie } from "../../../../lib/auth/cookies";
import { getSessionFromRequest } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await setAuthCookie(session.token);
  return NextResponse.json({ authenticated: true });
}
