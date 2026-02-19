import { AppShell } from "@/components/layout/AppShell";
import { ProjectSettingsClient } from "./_components/ProjectSettingsClient";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
};

export default async function ProjectPoliciesSettingsPage({ params }: Props) {
  const { workspaceSlug } = await params;

  return (
    <AppShell title="Ustawienia projektu" activeHref={`/w/${workspaceSlug}/settings/project`} workspaceSlug={workspaceSlug}>
      <ProjectSettingsClient workspaceSlug={workspaceSlug} />
    </AppShell>
  );
}
