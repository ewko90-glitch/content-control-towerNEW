"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

import { ProjectContextBar, useProjectContext } from "@/components/projects/ProjectContext";
import { DailyExecutionMode } from "@/app/w/[workspaceSlug]/content/_components/daily-execution-mode";
import { ExecutiveDigest } from "@/app/w/[workspaceSlug]/content/_components/executive-digest";
import { PressureIndicator } from "@/app/w/[workspaceSlug]/content/_components/pressure-indicator";
import type { WeeklyReviewOutcome } from "@/app/w/[workspaceSlug]/content/_components/weekly-review";
import { getProjectPlanningContext, listPublications } from "@/lib/projects/projectStore";

const WeeklyReviewWithRoiLite = dynamic<any>(
  async () => ((await import("@/app/w/[workspaceSlug]/content/_components/roi-lite")).WeeklyReviewWithRoiLite as never),
  { ssr: false },
);

type ProjectOverviewViewProps = {
  workspaceSlug: string;
  projectId?: string;
};

export function ProjectOverviewView(_: ProjectOverviewViewProps) {
  const { workspaceSlug, projectId, project, hasTokens, currentMember } = useProjectContext();
  const workspaceId = `workspace:${workspaceSlug}`;
  const assigneeId = "self";
  const planningContext = getProjectPlanningContext(project);
  const publications = listPublications(project.workspaceId, project.id);
  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;
  const mineNext7Days = publications.filter((publication) => {
    const ts = new Date(publication.dataPublikacjiISO).getTime();
    return publication.assigneeId === currentMember.id && ts >= now && ts <= next7Boundary;
  }).length;
  const clustersPreview = planningContext.clusters.slice(0, 4).join(", ") || "klastry nieustalone";
  const channelsPreview = planningContext.channels.join(", ") || "kanały nieustalone";

  const outcomes: WeeklyReviewOutcome[] = [
    {
      outcome: "completed",
      kind: "draft",
      durationSeconds: 1800,
      estMins: 30,
      assigneeId: "self",
      assigneeName: "Ja",
    },
    {
      outcome: "partial",
      kind: "optimization",
      durationSeconds: 900,
      estMins: 15,
      assigneeId: "self",
      assigneeName: "Ja",
    },
  ];

  return (
    <div>
      <ProjectContextBar />

      <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Przegląd projektu</h2>
        <p className="mt-1 text-sm text-[#64748B]">Centrum dowodzenia: Tryb Dnia, Pressure, Digest, Weekly Review i ROI.</p>
        {projectId ? <p className="mt-1 text-xs text-[#94A3B8]">Scope projektu: {projectId}</p> : null}
      </div>

      <DailyExecutionMode
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        items={[]}
        members={[{ id: "self", name: "Ja" }]}
        hasPlan
        isWeekCovered
        hasOverdue={false}
        hasNewsletterThisWeek
        isProjectReady
        openCalendarHref={`/w/${workspaceSlug}/calendar`}
        generatePlanHref={`/w/${workspaceSlug}/calendar/refresh`}
        coverageHref={`/w/${workspaceSlug}/calendar`}
        weeklyPressureScore={34}
        onStartFocusSession={() => {}}
        onRecordFocusOutcome={async () => ({ ok: true })}
      />

      <PressureIndicator
        workspaceId={workspaceId}
        assigneeId={assigneeId}
        totalPressure={34}
        backlogScore={30}
        timeScore={36}
        coverageScore={35}
        band="średnie"
      />

      <ExecutiveDigest
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        assigneeId={assigneeId}
        assigneeLabel="Ja"
        outcomesFiltered={outcomes}
        totalPressure={34}
        weeklyCoverageCount={3}
      />

      <WeeklyReviewWithRoiLite
        workspaceId={workspaceId}
        outcomes={outcomes}
        members={[{ id: "self", name: "Ja" }]}
        refreshHref={`/w/${workspaceSlug}/calendar/refresh`}
        weeklyPressureScore={34}
      />

      <article className="mb-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">AI w tym projekcie</h3>
        <p className="mt-1 text-sm text-[#64748B]">
          AI w tym projekcie będzie działać na podstawie: {clustersPreview}, kanały: {channelsPreview}, cadence: {planningContext.cadenceFrequency}/tydzień.
        </p>
        {!hasTokens ? (
          <p className="mt-2 text-sm text-amber-700">Tokeny AI wyczerpane — możesz pracować ręcznie, a AI jest wstrzymane.</p>
        ) : null}
      </article>

      <article className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Twoje publikacje w tym tygodniu</h3>
        <p className="mt-1 text-sm text-[#475569]">{mineNext7Days}</p>
        {mineNext7Days === 0 ? (
          <p className="mt-1 text-sm text-[#64748B]">Brak przypisanych publikacji na ten tydzień.</p>
        ) : null}
        <Link href={`/projects/${projectId ?? ""}/tresci?filter=mine`} className="mt-2 inline-flex text-xs font-medium text-[#5B7CFA] hover:underline">
          Zobacz moje publikacje
        </Link>
      </article>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/projects/${projectId ?? ""}/kalendarz`} className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#475569]">
          Kalendarz projektu
        </Link>
        <Link href={`/projects/${projectId ?? ""}/tresci`} className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#475569]">
          Treści
        </Link>
      </div>
    </div>
  );
}
