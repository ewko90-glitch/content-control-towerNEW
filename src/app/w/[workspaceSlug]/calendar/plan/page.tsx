import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requireWorkspaceAccess } from "@/lib/auth/workspace";
import { createPlan } from "@/server/actions/plans";
import { listProjects } from "@/server/queries/projects";

type PageProps = {
  params: Promise<{ workspaceSlug: string }>;
};

const dayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const channelOptions = ["blog", "linkedin", "newsletter"] as const;

function countExpectedItems(params: { horizonWeeks: number; days: number; channels: string[]; freq: "weekly" | "biweekly" }): number {
  const activeWeeks = params.freq === "biweekly" ? Math.ceil(params.horizonWeeks / 2) : params.horizonWeeks;
  const nonNewsletterChannels = params.channels.filter((channel) => channel !== "newsletter").length;
  const newsletterCount = params.channels.includes("newsletter") ? activeWeeks : 0;
  return activeWeeks * params.days * nonNewsletterChannels + newsletterCount;
}

export default async function GeneratePlanPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  async function createPlanAction(formData: FormData) {
    "use server";

    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");

    const cadenceFreq = String(formData.get("cadenceFreq") ?? "weekly");
    const daysOfWeek = formData
      .getAll("daysOfWeek")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

    const channels = formData
      .getAll("channels")
      .map((value) => String(value).toLowerCase())
      .filter((value) => value === "blog" || value === "linkedin" || value === "newsletter" || value === "landing");

    const result = await createPlan(access.workspace.id, {
      projectId: String(formData.get("projectId") ?? ""),
      name: String(formData.get("name") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      cadence: {
        freq: cadenceFreq === "biweekly" ? "biweekly" : "weekly",
        daysOfWeek,
      },
      channels,
      horizonWeeks: Number(formData.get("horizonWeeks") ?? 8),
    });

    if (!result.ok) {
      redirect(`/w/${workspaceSlug}/calendar/plan?error=${encodeURIComponent(result.error.message)}`);
    }

    redirect(`/w/${workspaceSlug}/calendar?planId=${result.data.planId}`);
  }

  try {
    const access = await requireWorkspaceAccess(workspaceSlug, "EDITOR");
    const projects = await listProjects(access.workspace.id);
    const readyProjects = projects.filter((project) => project.status === "active" && project.readinessState === "ready");

    const expectedItems = countExpectedItems({
      horizonWeeks: 8,
      days: 2,
      channels: ["blog", "linkedin", "newsletter"],
      freq: "weekly",
    });

    return (
      <AppShell
        title={`Generate Plan: ${access.workspace.name}`}
        subtitle="Deterministic SEO calendar builder"
        activeHref={`/w/${access.workspace.slug}/calendar`}
        workspaceSlug={access.workspace.slug}
      >
        <PageHeader
          title="Generate SEO Calendar"
          subtitle="Build coherent publication pipeline before writing"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href={`/w/${workspaceSlug}/calendar/refresh`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
              >
                Odśwież plan
              </Link>
              <Link
                href={`/w/${workspaceSlug}/calendar`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface2 px-4 text-sm font-medium text-text"
              >
                Wróć do kalendarza
              </Link>
            </div>
          }
        />

        <Card className="rounded-2xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle>Plan Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-border bg-surface2 p-4 text-sm text-muted">
              <p>Preview summary</p>
              <p>Clusters count: available after generation</p>
              <p>Expected items (default setup): {expectedItems}</p>
            </div>

            <form action={createPlanAction} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted" htmlFor="projectId">
                    Project
                  </label>
                  <select
                    id="projectId"
                    name="projectId"
                    aria-label="Select project"
                    title="Select project"
                    required
                    className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose ready project
                    </option>
                    {projects.map((project) => {
                      const disabled = !readyProjects.some((item) => item.id === project.id);
                      return (
                        <option key={project.id} value={project.id} disabled={disabled}>
                          {project.name} {disabled ? "(Needs readiness)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted" htmlFor="name">
                    Plan name
                  </label>
                  <Input id="name" name="name" required placeholder="Q2 SEO Calendar" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted" htmlFor="startDate">
                    Start date
                  </label>
                  <Input id="startDate" name="startDate" type="date" required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted" htmlFor="cadenceFreq">
                    Cadence
                  </label>
                  <select
                    id="cadenceFreq"
                    name="cadenceFreq"
                    aria-label="Select cadence"
                    title="Select cadence"
                    defaultValue="weekly"
                    className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm text-muted">Days of week</p>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map((day) => (
                      <label key={day.value} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text">
                        <input type="checkbox" name="daysOfWeek" value={day.value} defaultChecked={day.value === 2 || day.value === 4} />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm text-muted">Channels</p>
                  <div className="flex flex-wrap gap-2">
                    {channelOptions.map((channel) => (
                      <label key={channel} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text">
                        <input type="checkbox" name="channels" value={channel} defaultChecked />
                        {channel}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted" htmlFor="horizonWeeks">
                    Horizon weeks
                  </label>
                  <select
                    id="horizonWeeks"
                    name="horizonWeeks"
                    defaultValue="8"
                    aria-label="Select horizon weeks"
                    title="Select horizon weeks"
                    className="h-11 w-full rounded-xl border border-border bg-surface2 px-3 text-sm text-text"
                  >
                    <option value="8">8</option>
                    <option value="12">12</option>
                  </select>
                </div>
              </div>

              <Button type="submit">Generate SEO Calendar</Button>
            </form>
          </CardContent>
        </Card>
      </AppShell>
    );
  } catch {
    notFound();
  }
}
