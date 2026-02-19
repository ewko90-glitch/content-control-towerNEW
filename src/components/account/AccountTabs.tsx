"use client";

import { useState } from "react";
import { ProfileTab } from "./ProfileTab";
import { TeamTab } from "./TeamTab";
import { PlanTab } from "./PlanTab";
import { NotificationsTab } from "./NotificationsTab";

type Tab = "profil" | "zespol" | "plan" | "powiadomienia";

export type WorkspaceMember = {
  id: string;
  userId: string;
  role: string;
  user: { email: string; name: string | null; avatarUrl: string | null };
};

export type Project = {
  id: string;
  name: string;
  slug: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: string;
};

export type AccountTabsProps = {
  user: { id: string; email: string; name: string | null };
  workspace: { id: string; name: string; slug: string } | null;
  members: WorkspaceMember[];
  projects: Project[];
  projectMemberships: ProjectMember[];
  plan: { tier: string; seatsLimit: number; projectsLimit: number; aiCreditsMonthly: number } | null;
  usage: { seatsUsed: number; projectsUsed: number } | null;
};

const tabs: { key: Tab; label: string }[] = [
  { key: "profil", label: "Profil" },
  { key: "zespol", label: "Zespół" },
  { key: "plan", label: "Plan & Płatność" },
  { key: "powiadomienia", label: "Powiadomienia" },
];

export function AccountTabs(props: AccountTabsProps) {
  const [active, setActive] = useState<Tab>("profil");

  return (
    <div className="flex min-h-screen bg-[#F4F6FB]">
      {/* Sidebar nav */}
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white px-4 py-8">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Ustawienia konta
        </p>
        <nav className="flex flex-col gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                active === t.key
                  ? "bg-[#5B7CFA]/10 text-[#5B7CFA]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-8 py-8">
        {active === "profil" && <ProfileTab user={props.user} />}
        {active === "zespol" && (
          <TeamTab
            workspaceId={props.workspace?.id ?? ""}
            members={props.members}
            projects={props.projects}
            projectMemberships={props.projectMemberships}
          />
        )}
        {active === "plan" && (
          <PlanTab plan={props.plan} usage={props.usage} workspaceId={props.workspace?.id ?? ""} />
        )}
        {active === "powiadomienia" && <NotificationsTab />}
      </main>
    </div>
  );
}
