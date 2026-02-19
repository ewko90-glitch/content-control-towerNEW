import { NextResponse } from "next/server";

import { createAuditLog } from "../../../../lib/auth/audit";
import { setAuthCookie } from "../../../../lib/auth/cookies";
import { verifyPassword } from "../../../../lib/auth/password";
import { getRequestMeta } from "../../../../lib/auth/request";
import { createSession } from "../../../../lib/auth/session";
import { resolvePostLoginRedirect } from "../../../../lib/auth/workspace";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";

function redirectWithError(request: Request, message: string, nextValue?: string) {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("error", message);
  if (nextValue && nextValue.startsWith("/")) {
    url.searchParams.set("next", nextValue);
  }
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextValue = String(formData.get("next") ?? "").trim();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return redirectWithError(request, "Nieprawidłowy email lub hasło", nextValue);
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return redirectWithError(request, "Nieprawidłowy email lub hasło", nextValue);
  }

  if (!user.emailVerifiedAt) {
    return redirectWithError(request, "Konto nie zostało zweryfikowane", nextValue);
  }

  const session = await createSession(user.id, getRequestMeta(request));
  await setAuthCookie(session.token);

  await createAuditLog({
    action: "AUTH_LOGIN",
    userId: user.id,
    ip: getRequestMeta(request).ipAddress,
    userAgent: getRequestMeta(request).userAgent,
  });

  const redirectTarget = nextValue.startsWith("/") ? nextValue : await resolvePostLoginRedirect(user.id);
  return NextResponse.redirect(new URL(redirectTarget, request.url));
}
