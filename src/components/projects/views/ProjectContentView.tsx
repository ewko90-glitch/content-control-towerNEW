import Link from "next/link";

import { PublicationsTable } from "@/components/projects/PublicationsTable";
import { ProjectContextBar, useProjectContext } from "@/components/projects/ProjectContext";
import type { PublicationJob, PublicationStatus } from "@/lib/projects/projectStore";

type ProjectContentViewProps = {
  workspaceSlug: string;
  projectId?: string;
  publications: PublicationJob[];
  onChangeStatus: (formData: FormData) => void;
  onAddAiVersion: (formData: FormData) => Promise<void>;
  onSetPublicationDraft: (formData: FormData) => Promise<void>;
};

const sections: Array<{ status: PublicationStatus; label: string }> = [
  { status: "pomysl", label: "Pomysły" },
  { status: "szkic", label: "Szkice" },
  { status: "do_akceptacji", label: "Do akceptacji" },
  { status: "zaplanowane", label: "Zaplanowane" },
  { status: "opublikowane", label: "Opublikowane" },
];

export function ProjectContentView({ publications, onChangeStatus, onAddAiVersion, onSetPublicationDraft }: ProjectContentViewProps) {
  const { workspaceSlug, projectId, project } = useProjectContext();

  return (
    <div>
      <ProjectContextBar />
      <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Treści</h2>
        <p className="mt-1 text-sm text-[#64748B]">Zarządzaj tematami, szkicami i publikacjami.</p>
        {projectId ? <p className="mt-1 text-xs text-[#94A3B8]">Scope projektu: {projectId}</p> : null}

        <p className="mt-3 rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#475569]">
          Ten projekt: {project.domenaLubKanal}, język: {project.jezyk.toUpperCase()}, ton komunikacji: {project.tonKomunikacji}.
        </p>

        <Link
          href={`/w/${workspaceSlug}/content`}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white"
        >
          Otwórz zarządzanie treścią
        </Link>
      </section>

      <section className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Spis treści i publikacji</h3>
        <p className="mt-1 text-sm text-[#64748B]">Pracuj na backlogu tematów i przenoś wpisy między statusami.</p>

        <div className="mt-3 space-y-4">
          {sections.map((section) => {
            const items = publications.filter((publication) => publication.status === section.status);
            return (
              <div key={section.status}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#475569]">{section.label}</h4>
                <PublicationsTable
                  publications={items}
                  onChangeStatus={onChangeStatus}
                  onAddAiVersion={onAddAiVersion}
                  onSetPublicationDraft={onSetPublicationDraft}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
