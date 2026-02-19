import { prisma } from "@/lib/prisma";

type NotifyInput = {
  workspaceId: string;
  userId?: string | null;
  title: string;
  body?: string;
};

export async function notifyWorkflow(input: NotifyInput) {
  await prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId ?? null,
      type: "WORKFLOW",
      title: input.title,
      body: input.body ?? null,
    },
  });
}