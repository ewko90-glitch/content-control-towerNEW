"use client";

import { useState } from "react";

import type { AiDraftVersion } from "@/lib/projects/projectStore";

type AiDraftVersionsProps = {
  versions: AiDraftVersion[];
  onApply: (kind: AiDraftVersion["kind"], content: string) => Promise<void>;
};

function kindLabel(kind: AiDraftVersion["kind"]): string {
  if (kind === "outline") {
    return "Outline";
  }
  if (kind === "draft") {
    return "Szkic";
  }
  return "SEO";
}

export function AiDraftVersions({ versions, onApply }: AiDraftVersionsProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (versions.length === 0) {
    return <p className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#64748B]">Brak wersji AI dla tej publikacji.</p>;
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => {
        const isPreviewOpen = previewId === version.id;
        return (
          <article key={version.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">{version.title}</p>
                <p className="text-xs text-[#64748B]">{new Date(version.createdAtISO).toLocaleString("pl-PL")}</p>
              </div>
              <span className="inline-flex rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#475569]">
                {kindLabel(version.kind)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewId(isPreviewOpen ? null : version.id)}
                className="h-8 rounded-lg border border-[#E2E8F0] px-3 text-xs text-[#334155]"
              >
                Podgląd
              </button>
              <button
                type="button"
                onClick={async () => onApply(version.kind, version.content)}
                className="h-8 rounded-lg bg-[#5B7CFA] px-3 text-xs font-medium text-white"
              >
                Zastosuj
              </button>
            </div>

            {isPreviewOpen ? (
              <pre className="mt-3 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#334155]">
                {version.content}
              </pre>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
