import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth/session";

export const runtime = "nodejs";

// Placeholder — notification preferences stored client-side for now
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  // Future: persist to DB
  return NextResponse.json({ ok: true });
}
