import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/auth/OnboardingWizard";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../lib/auth/session";

export default async function OnboardingPage() {
  const user = await requireUser();

  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: user.id },
    select: { id: true },
    take: 1,
  });

  if (memberships.length > 0) {
    redirect("/overview");
  }

  return <OnboardingWizard />;
}
