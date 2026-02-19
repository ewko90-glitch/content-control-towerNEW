import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth/session";
import { hashPassword, verifyPassword } from "../../../../lib/auth/password";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const body = await request.json() as { oldPassword?: string; newPassword?: string };
  const { oldPassword, newPassword } = body;

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: "Brak wymaganych pól" }, { status: 400 });
  }
  if (newPassword.length < 10) {
    return NextResponse.json({ error: "Hasło musi mieć min. 10 znaków" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return NextResponse.json({ error: "Użytkownik nie istnieje" }, { status: 404 });

  const valid = await verifyPassword(oldPassword, dbUser.passwordHash);
  if (!valid) return NextResponse.json({ error: "Stare hasło jest nieprawidłowe" }, { status: 400 });

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  return NextResponse.json({ ok: true });
}
