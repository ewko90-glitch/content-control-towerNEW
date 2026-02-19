import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await request.json() as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() : null;

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name || null },
  });

  return NextResponse.json({ ok: true });
}
