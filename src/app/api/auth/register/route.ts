import { NextResponse } from "next/server";

import { createAuditLog } from "../../../../lib/auth/audit";
import { setAuthCookie } from "../../../../lib/auth/cookies";
import { hashPassword } from "../../../../lib/auth/password";
import { getRequestMeta } from "../../../../lib/auth/request";
import { createSession } from "../../../../lib/auth/session";
import { generateSecureToken } from "../../../../lib/auth/tokens";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

function redirectWithError(request: Request, message: string) {
  const url = new URL("/auth/register", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) {
    return redirectWithError(request, "Email i hasło są wymagane.");
  }

  if (password.length < 10) {
    return redirectWithError(request, "Hasło musi mieć minimum 10 znaków.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return redirectWithError(request, "Email jest już zajęty.");
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = generateSecureToken(32);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      emailVerifiedAt: new Date(), // auto-weryfikacja (brak systemu mailowego)
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const session = await createSession(user.id, getRequestMeta(request));
  await setAuthCookie(session.token);

  await createAuditLog({
    action: "AUTH_REGISTER",
    userId: user.id,
    ip: getRequestMeta(request).ipAddress,
    userAgent: getRequestMeta(request).userAgent,
  });

  const verifyLink = `${new URL(request.url).origin}/api/auth/verify-email?token=${verificationToken}`;
  console.log(`[CCT] Link weryfikacyjny: ${verifyLink}`);

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
