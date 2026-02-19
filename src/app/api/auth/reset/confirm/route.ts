import { NextResponse } from "next/server";

import { createAuditLog } from "../../../../../lib/auth/audit";
import { hashPassword } from "../../../../../lib/auth/password";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

function redirectWithError(request: Request, token: string, message: string) {
  const url = new URL(`/auth/reset/${token}`, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/reset", request.url));
  }

  if (password.length < 10) {
    return redirectWithError(request, token, "Hasło musi mieć minimum 10 znaków.");
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return redirectWithError(request, token, "Token resetu jest nieprawidłowy lub wygasł.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  await createAuditLog({
    action: "AUTH_PASSWORD_RESET_SUCCESS",
    userId: resetToken.userId,
  });

  const url = new URL("/auth/login", request.url);
  url.searchParams.set("success", "Hasło zostało zaktualizowane.");
  return NextResponse.redirect(url);
}
