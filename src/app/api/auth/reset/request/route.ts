import { NextResponse } from "next/server";

import { createAuditLog } from "../../../../../lib/auth/audit";
import { generateSecureToken } from "../../../../../lib/auth/tokens";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";

const GENERIC_MESSAGE = "Jeśli konto istnieje, wysłaliśmy instrukcję resetu hasła.";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user) {
      const token = generateSecureToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await createAuditLog({
        action: "AUTH_PASSWORD_RESET_REQUEST",
        userId: user.id,
      });

      const resetLink = `${new URL(request.url).origin}/auth/reset/${token}`;
      console.log(`[CCT] Link resetu hasła: ${resetLink}`);
    }
  }

  const url = new URL("/auth/reset", request.url);
  url.searchParams.set("success", GENERIC_MESSAGE);
  return NextResponse.redirect(url);
}
