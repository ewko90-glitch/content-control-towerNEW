import type { CommandContext, CommandDefinition } from "./command-types";

function workspaceContentHref(context: CommandContext): string {
  if (!context.workspaceSlug) {
    return "/overview";
  }
  return `/w/${context.workspaceSlug}/content`;
}

function workspaceCalendarHref(context: CommandContext): string {
  if (!context.workspaceSlug) {
    return "/overview";
  }
  return `/w/${context.workspaceSlug}/calendar`;
}

function withQuery(href: string, params: Record<string, string | undefined>): string {
  const url = new URL(href, "http://localhost");

  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function getCommandRegistry(): CommandDefinition[] {
  const commands: CommandDefinition[] = [
    {
      id: "goto-overview",
      title: "Przejdź do Overview",
      description: "Szybki podgląd workspace i statusu.",
      group: "navigate",
      keywords: ["overview", "dashboard", "status", "workspace"],
      groupPriority: 90,
      action: () => ({ kind: "navigate", href: "/overview" }),
    },
    {
      id: "goto-content",
      title: "Przejdź do Content Hub",
      description: "Otwiera główny obszar zarządzania contentem.",
      group: "navigate",
      keywords: ["content", "hub", "publikacje"],
      groupPriority: 90,
      when: (context) => Boolean(context.workspaceSlug),
      action: (context) => ({ kind: "navigate", href: workspaceContentHref(context) }),
    },
    {
      id: "plan-calendar",
      title: "Przejdź do Calendar",
      description: "Planowanie publikacji i terminów.",
      group: "navigate",
      keywords: ["calendar", "plan", "terminy"],
      groupPriority: 90,
      when: (context) => Boolean(context.workspaceSlug),
      action: (context) => ({ kind: "navigate", href: workspaceCalendarHref(context) }),
    },
    {
      id: "open-account",
      title: "Otwórz Account",
      description: "Przejdź do ustawień konta.",
      group: "navigate",
      keywords: ["konto", "account", "settings", "profil"],
      groupPriority: 90,
      action: () => ({ kind: "navigate", href: "/account" }),
    },
    {
      id: "new-content",
      title: "Utwórz nowy content",
      description: "Przejdź do sekcji tworzenia i priorytetów.",
      group: "create",
      keywords: ["new", "content", "create", "draft"],
      groupPriority: 80,
      when: (context) => Boolean(context.workspaceSlug),
      action: (context) => ({ kind: "navigate", href: `${workspaceContentHref(context)}#content-board` }),
    },
    {
      id: "new-publication-job",
      title: "Dodaj nowe zadanie publikacji",
      description: "Skupia widok na workflow publikacji.",
      group: "create",
      keywords: ["publikacja", "zadanie", "workflow", "job"],
      groupPriority: 80,
      when: (context) => Boolean(context.workspaceSlug),
      action: (context) => ({ kind: "navigate", href: `${workspaceContentHref(context)}#workflow-highlights` }),
    },
    {
      id: "open-decision-lab",
      title: "Otwórz Decision Lab",
      description: "Uruchamia panel scenariuszy i symulacji.",
      group: "decision-lab",
      keywords: ["decision", "lab", "symulacja", "scenariusz"],
      groupPriority: 100,
      when: (context) => context.hasDecisionLab,
      action: (context) => ({
        kind: "navigate",
        href: withQuery(workspaceContentHref(context), { cmd: "openDecisionLab" }),
      }),
    },
    {
      id: "simulate-capacity-bottleneck",
      title: "Symuluj +20% capacity bottleneck",
      description: "Otwiera Decision Lab z presetem zwiększenia przepustowości.",
      group: "decision-lab",
      keywords: ["capacity", "bottleneck", "simulate", "preset", "20%"],
      groupPriority: 100,
      when: (context) => context.hasDecisionLab,
      action: (context) => ({
        kind: "navigate",
        href: withQuery(workspaceContentHref(context), {
          cmd: "openDecisionLab",
          preset: "cap_up_20",
        }),
      }),
    },
    {
      id: "adopt-last-scenario",
      title: "Adopt last scenario",
      description: "Ustawia ostatni scenariusz jako bieżącą strategię.",
      group: "decision-lab",
      keywords: ["adopt", "strategy", "decision", "scenario"],
      groupPriority: 102,
      when: (context) => context.hasDecisionEntries && Boolean(context.latestDecisionId),
      action: () => ({ kind: "noop" }),
    },
    {
      id: "reject-last-scenario",
      title: "Reject last scenario",
      description: "Odrzuca ostatnio przeanalizowany scenariusz.",
      group: "decision-lab",
      keywords: ["reject", "decision", "scenario", "timeline"],
      groupPriority: 101,
      when: (context) => context.hasDecisionEntries && Boolean(context.latestDecisionId),
      action: () => ({ kind: "noop" }),
    },
    {
      id: "clear-current-strategy",
      title: "Clear current strategy",
      description: "Czyści aktualnie adoptowaną strategię.",
      group: "decision-lab",
      keywords: ["clear", "strategy", "adopted", "decision"],
      groupPriority: 100,
      when: (context) => context.hasCurrentStrategy,
      action: () => ({ kind: "noop" }),
    },
    {
      id: "view-decision-timeline",
      title: "View decision timeline",
      description: "Przechodzi do osi decyzji operacyjnych.",
      group: "decision-lab",
      keywords: ["timeline", "decision", "history", "strategy"],
      groupPriority: 99,
      when: (context) => context.hasDecisionEntries,
      action: (context) => ({ kind: "navigate", href: `${workspaceContentHref(context)}#decision-timeline` }),
    },
    {
      id: "jump-workflow",
      title: "Skocz do bottleneck workflow",
      description: "Przenosi do sekcji workflow i highlights.",
      group: "workflow",
      keywords: ["workflow", "bottleneck", "flow", "stage"],
      groupPriority: 70,
      when: (context) => Boolean(context.workspaceSlug),
      contextBoost: (context) => (context.bottleneckStage ? 8 : 0),
      action: (context) => ({ kind: "navigate", href: `${workspaceContentHref(context)}#workflow-highlights` }),
    },
    {
      id: "jump-risks",
      title: "Skocz do ryzyk i predykcji",
      description: "Przenosi do sekcji predykcyjnego ryzyka.",
      group: "risk-analysis",
      keywords: ["risk", "ryzyko", "predykcja", "pressure"],
      groupPriority: 75,
      when: (context) => Boolean(context.workspaceSlug),
      action: (context) => ({ kind: "navigate", href: `${workspaceContentHref(context)}#predictive-risk-chip` }),
    },
    {
      id: "show-shortcuts",
      title: "Pokaż skróty klawiaturowe",
      description: "Szybka ściąga do nawigacji.",
      group: "help",
      keywords: ["help", "shortcuts", "skróty", "pomoc"],
      groupPriority: 40,
      action: () => ({ kind: "navigate", href: "/overview#shortcuts" }),
    },
    {
      id: "executive-open",
      title: "Executive: Open",
      description: "Włącza Executive Mode i przewija do podsumowania.",
      group: "navigate",
      keywords: ["executive", "summary", "board", "snapshot"],
      groupPriority: 96,
      when: (context) => context.isContentPage,
      action: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cct:exec:open"));
        }
        return { kind: "noop" };
      },
    },
    {
      id: "executive-export-pdf",
      title: "Executive: Export PDF",
      description: "Uruchamia druk do PDF dla Executive Summary.",
      group: "navigate",
      keywords: ["executive", "pdf", "print", "export"],
      groupPriority: 95,
      when: (context) => context.isContentPage,
      action: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cct:exec:export"));
        }
        return { kind: "noop" };
      },
    },
  ];

  return commands;
}
