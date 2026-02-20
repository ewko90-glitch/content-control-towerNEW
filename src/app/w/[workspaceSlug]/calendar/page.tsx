import { notFound } from "next/navigation";

import { CalendarClientShell } from "@/components/calendar/CalendarClientShell";
import { AppShell } from "@/components/layout/AppShell";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function CalendarPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "VIEWER");
    const now = new Date();

    const [projects, memberships] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId: access.workspace.id, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workspaceMembership.findMany({
        where: { workspaceId: access.workspace.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const members = memberships.map((m) => m.user);

    return (
      <AppShell
        title="Kalendarz treści"
        subtitle="Planuj, przypisuj i śledź posty we wszystkich kanałach"
        activeHref={`/w/${access.workspace.slug}/calendar`}
        workspaceSlug={access.workspace.slug}
      >
        <div className="px-1 pb-8">
          <CalendarClientShell
            workspaceSlug={workspaceSlug}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth() + 1}
            initialProjects={projects}
            initialMembers={members}
          />
        </div>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
