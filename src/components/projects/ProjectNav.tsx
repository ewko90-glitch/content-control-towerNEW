import Link from "next/link";

type ProjectNavProps = {
  projectId: string;
  workspaceSlug?: string;
  active: "overview" | "calendar" | "content" | "strategy" | "results" | "settings";
};

const tabs: Array<{ key: ProjectNavProps["active"]; label: string; href: (projectId: string) => string }> = [
  { key: "overview", label: "Przegląd", href: (projectId) => `/projects/${projectId}` },
  { key: "calendar", label: "Kalendarz", href: (projectId) => `/projects/${projectId}/calendar` },
  { key: "content", label: "Treści", href: (projectId) => `/projects/${projectId}/content` },
  { key: "strategy", label: "Strategia AI", href: (projectId) => `/projects/${projectId}#strategia-ai` },
  { key: "results", label: "Wyniki", href: (projectId) => `/projects/${projectId}#wyniki` },
  { key: "settings", label: "Ustawienia", href: (projectId) => `/projects/${projectId}#ustawienia` },
];

export function ProjectNav({ projectId, workspaceSlug, active }: ProjectNavProps) {
  const resolvedTabs = tabs.map((tab) => {
    if (workspaceSlug && tab.key === "content") {
      return { ...tab, href: () => `/w/${workspaceSlug}/content` };
    }
    if (workspaceSlug && tab.key === "strategy") {
      return { ...tab, href: () => `/w/${workspaceSlug}/content` };
    }
    if (workspaceSlug && tab.key === "results") {
      return { ...tab, href: () => `/w/${workspaceSlug}/calendar/refresh` };
    }
    if (workspaceSlug && tab.key === "settings") {
      return { ...tab, href: () => `/projects/${projectId}#ustawienia` };
    }
    return tab;
  });

  return (
    <nav className="flex flex-col gap-2">
      {resolvedTabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href(projectId)}
            className={[
              "inline-flex h-10 items-center justify-start rounded-2xl border px-4 text-sm font-medium transition-colors",
              isActive
                ? "border-[#5B7CFA] bg-[#EEF2FF] text-[#3B5BDB]"
                : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
