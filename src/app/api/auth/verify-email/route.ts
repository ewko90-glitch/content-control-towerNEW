import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
import { createAuditLog } from "../../../../lib/auth/audit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new Response("Brak tokenu weryfikacji.", { status: 400 });
  }

  const verification = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verification || verification.usedAt || verification.expiresAt <= new Date()) {
    return new Response("Token weryfikacji jest nieprawidłowy lub wygasł.", { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await createAuditLog({
    action: "AUTH_EMAIL_VERIFIED",
    userId: verification.userId,
  });

  return new Response("Email został zweryfikowany.", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
