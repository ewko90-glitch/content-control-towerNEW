import Link from "next/link";

import { ProjectContextBar, useProjectContext } from "@/components/projects/ProjectContext";
import { NewPublicationModal } from "@/components/projects/NewPublicationModal";
import { PublicationsTable } from "@/components/projects/PublicationsTable";
import { getProjectPlanningContext, type PublicationJob } from "@/lib/projects/projectStore";

type ProjectCalendarViewProps = {
  workspaceSlug: string;
  projectId?: string;
  publications: PublicationJob[];
  onCreatePublication: (formData: FormData) => void;
  onChangeStatus: (formData: FormData) => void;
  onAddAiVersion: (formData: FormData) => Promise<void>;
  onSetPublicationDraft: (formData: FormData) => Promise<void>;
  onDeletePublication: (formData: FormData) => void;
};

const dayLabels: Record<number, string> = {
  1: "Poniedziałek",
  2: "Wtorek",
  3: "Środa",
  4: "Czwartek",
  5: "Piątek",
  6: "Sobota",
  7: "Niedziela",
};

function getNearestPublishingWindow(days: number[]): string {
  if (days.length === 0) {
    return "Brak zdefiniowanych dni";
  }

  const now = new Date();
  const today = now.getDay() === 0 ? 7 : now.getDay();
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = ((today + offset - 1) % 7) + 1;
    if (days.includes(candidate)) {
      return offset === 0 ? `Dziś (${dayLabels[candidate]})` : `Za ${offset} dni (${dayLabels[candidate]})`;
    }
  }
  return dayLabels[days[0]] ?? "Brak";
}

export function ProjectCalendarView({
  publications,
  onCreatePublication,
  onChangeStatus,
  onAddAiVersion,
  onSetPublicationDraft,
  onDeletePublication,
}: ProjectCalendarViewProps) {
  const { workspaceSlug, projectId, project } = useProjectContext();
  const planningContext = getProjectPlanningContext(project);
  const channels = planningContext.channels.length > 0
    ? planningContext.channels.join(" • ")
    : "Brak kanałów";
  const days = planningContext.cadenceDays.length > 0
    ? planningContext.cadenceDays
        .slice()
        .sort((left, right) => left - right)
        .map((day) => dayLabels[day] ?? `Dzień ${day}`)
        .join(" • ")
    : "Brak dni";

  return (
    <div>
      <ProjectContextBar />
      <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Kalendarz projektu</h2>
        <p className="mt-1 text-sm text-[#64748B]">Tutaj planujesz i przeglądasz publikacje dla tego projektu.</p>
        {projectId ? <p className="mt-1 text-xs text-[#94A3B8]">Scope projektu: {projectId}</p> : null}

        <div className="mt-4 grid gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#475569]">
          <p><span className="font-medium text-[#0F172A]">Kanały publikacji:</span> {channels}</p>
          <p><span className="font-medium text-[#0F172A]">Częstotliwość:</span> {planningContext.cadenceFrequency}/tydzień</p>
          <p><span className="font-medium text-[#0F172A]">Dni tygodnia:</span> {days}</p>
          <p><span className="font-medium text-[#0F172A]">Najbliższe okno publikacji:</span> {getNearestPublishingWindow(planningContext.cadenceDays)}</p>
        </div>

        <Link
          href={`/w/${workspaceSlug}/calendar`}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white"
        >
          Otwórz kalendarz
        </Link>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0F172A]">Zaplanowane publikacje</h3>
          <NewPublicationModal
            channels={
              project.kanaly.length > 0
                ? project.kanaly.map((channel) => ({ value: channel.typ, label: channel.nazwa || channel.typ }))
                : [{ value: "inne", label: "Inne" }]
            }
            onCreate={onCreatePublication}
          />
        </div>

        <PublicationsTable
          publications={publications}
          onChangeStatus={onChangeStatus}
          onAddAiVersion={onAddAiVersion}
          onSetPublicationDraft={onSetPublicationDraft}
          onDelete={onDeletePublication}
        />
      </section>
    </div>
  );
}
