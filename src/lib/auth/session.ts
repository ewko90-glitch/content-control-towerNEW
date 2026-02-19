import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "../prisma";
import { COOKIE_NAME, SESSION_DURATION_MS } from "./constants";
import { generateSecureToken } from "./tokens";

type SessionMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function parseTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  const value = cookie.slice(`${COOKIE_NAME}=`.length);
  return value.length > 0 ? decodeURIComponent(value) : null;
}

export async function createSession(userId: string, meta: SessionMeta = {}) {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  return prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
}

export async function validateSession(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  const nextExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: nextExpiresAt },
  });

  return {
    ...session,
    expiresAt: nextExpiresAt,
  };
}

export async function destroySession(token: string | null | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await prisma.session.deleteMany({ where: { token } });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const session = await validateSession(token);
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

export async function getUserFromRequest(request: Request) {
  const token = parseTokenFromCookieHeader(request.headers.get("cookie"));
  const session = await validateSession(token);
  return session?.user ?? null;
}

export async function getSessionFromRequest(request: Request) {
  const token = parseTokenFromCookieHeader(request.headers.get("cookie"));
  return validateSession(token);
}
