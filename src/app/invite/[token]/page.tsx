import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { getCurrentUser } from "../../../lib/auth/session";
import { prisma } from "../../../lib/prisma";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const routeParams = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(`/invite/${routeParams.token}`)}`);
  }

  const invite = await prisma.workspaceInvite.findUnique({
    where: { token: routeParams.token },
    include: {
      workspace: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt <= new Date()) {
    return (
      <AuthLayout title="Zaproszenie" description="Sprawdź status zaproszenia do workspace.">
        <Alert variant="danger">To zaproszenie jest nieprawidłowe lub wygasło.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Akceptacja zaproszenia" description="Dołącz do zespołu i rozpocznij współpracę.">
      <div className="space-y-2 rounded-xl bg-surface2 p-3 text-sm">
        <p>
          Workspace: <strong>{invite.workspace.name}</strong>
        </p>
        <p>
          Rola: <strong>{invite.role}</strong>
        </p>
      </div>
      <form action="/api/invite/accept" method="post" className="mt-4">
        <input type="hidden" name="token" value={routeParams.token} />
        <Button type="submit" className="w-full">
          Dołącz do workspace
        </Button>
      </form>
    </AuthLayout>
  );
}
