"use client";

import { useEffect, useMemo, useState } from "react";
import { loadDecisionStore, transitionDecisionStatus } from "@/components/decision-intelligence/decision-storage";
import { commandCopy } from "./command-copy";
import { readRecentCommands, pushRecentCommand } from "./command-history";
import { useCommandProvider } from "./command-provider";
import { getCommandRegistry } from "./command-registry";
import { searchCommands } from "./command-search";
import type { CommandDefinition, RankedCommand } from "./command-types";
import { CommandPaletteUi } from "./command-ui";

function mergeRecentAtTop(results: RankedCommand[], recentIds: string[]): RankedCommand[] {
  if (recentIds.length === 0) {
    return results;
  }

  const commandMap = new Map(results.map((entry) => [entry.command.id, entry]));
  const recentEntries: RankedCommand[] = [];

  for (const commandId of recentIds) {
    const original = commandMap.get(commandId);
    if (!original) {
      continue;
    }

    recentEntries.push({
      ...original,
      command: {
        ...original.command,
        group: "recent",
        groupPriority: 110,
      },
      score: original.score + 300,
    });
  }

  const recentSet = new Set(recentEntries.map((entry) => entry.command.id));
  const remaining = results.filter((entry) => !recentSet.has(entry.command.id));
  return [...recentEntries, ...remaining];
}

export function CommandOS() {
  const { open, setOpen, runtimeContext, runAction } = useCommandProvider();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const registry = useMemo(() => {
    const restartSpotlightCommand: CommandDefinition = {
      id: "restart-spotlight",
      title: "Uruchom ponownie Spotlight",
      description: "Ponownie uruchamia adaptacyjny onboarding operacyjny.",
      group: "help",
      keywords: ["spotlight", "restart", "onboarding", "adaptive"],
      groupPriority: 95,
      action: () => ({ kind: "noop" }),
    };

    return [...getCommandRegistry(), restartSpotlightCommand];
  }, []);

  useEffect(() => {
    const openHandler = () => {
      setOpen(true);
    };

    window.addEventListener("cct:command-os:open", openHandler as EventListener);
    return () => {
      window.removeEventListener("cct:command-os:open", openHandler as EventListener);
    };
  }, [setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setRecentIds(readRecentCommands(runtimeContext.workspaceSlug));
  }, [open, runtimeContext.workspaceSlug]);

  const ranked = useMemo(
    () =>
      searchCommands({
        query,
        commands: registry,
        context: runtimeContext,
        recentCommandIds: recentIds,
      }),
    [query, registry, runtimeContext, recentIds],
  );

  const visibleResults = useMemo(
    () => (query.trim().length === 0 ? mergeRecentAtTop(ranked, recentIds) : ranked),
    [query, ranked, recentIds],
  );

  useEffect(() => {
    setActiveIndex((current) => {
      if (visibleResults.length === 0) {
        return 0;
      }
      return Math.min(current, visibleResults.length - 1);
    });
  }, [visibleResults]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (visibleResults.length === 0) {
            return 0;
          }
          return (current + 1) % visibleResults.length;
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (visibleResults.length === 0) {
            return 0;
          }
          return (current - 1 + visibleResults.length) % visibleResults.length;
        });
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const selected = visibleResults[activeIndex];
        if (!selected) {
          return;
        }

        if (selected.command.id === "restart-spotlight") {
          window.dispatchEvent(new CustomEvent("cct:spotlight:restart"));
          setOpen(false);
          return;
        }

        const updated = pushRecentCommand(runtimeContext.workspaceSlug, selected.command.id);
        setRecentIds(updated);
        runAction(selected.command.action(runtimeContext));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, visibleResults, activeIndex, runtimeContext, runAction]);

  function handleDecisionCommand(commandId: string): boolean {
    if (!runtimeContext.workspaceSlug) {
      return false;
    }

    if (commandId === "adopt-last-scenario") {
      const store = loadDecisionStore(runtimeContext.workspaceSlug);
      const latest = store.entries[0];
      if (!latest) {
        return true;
      }
      transitionDecisionStatus(runtimeContext.workspaceSlug, latest.id, "adopted");
      window.dispatchEvent(new CustomEvent("cct:decision:updated"));
      setOpen(false);
      return true;
    }

    if (commandId === "reject-last-scenario") {
      const store = loadDecisionStore(runtimeContext.workspaceSlug);
      const latest = store.entries[0];
      if (!latest) {
        return true;
      }
      transitionDecisionStatus(runtimeContext.workspaceSlug, latest.id, "rejected");
      window.dispatchEvent(new CustomEvent("cct:decision:updated"));
      setOpen(false);
      return true;
    }

    if (commandId === "clear-current-strategy") {
      const store = loadDecisionStore(runtimeContext.workspaceSlug);
      if (!store.currentStrategyId) {
        return true;
      }
      transitionDecisionStatus(runtimeContext.workspaceSlug, store.currentStrategyId, "explored");
      window.dispatchEvent(new CustomEvent("cct:decision:updated"));
      setOpen(false);
      return true;
    }

    return false;
  }

  function executeIndex(index: number) {
    const selected = visibleResults[index];
    if (!selected) {
      return;
    }

    if (selected.command.id === "restart-spotlight") {
      window.dispatchEvent(new CustomEvent("cct:spotlight:restart"));
      setOpen(false);
      return;
    }

        if (handleDecisionCommand(selected.command.id)) {
          return;
        }

    if (handleDecisionCommand(selected.command.id)) {
      return;
    }

    const updated = pushRecentCommand(runtimeContext.workspaceSlug, selected.command.id);
    setRecentIds(updated);
    runAction(selected.command.action(runtimeContext));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[90] hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition hover:text-card-foreground lg:block"
        aria-label="Otwórz Command OS"
      >
        {commandCopy.keyboardHint}
      </button>
      <CommandPaletteUi
        open={open}
        query={query}
        activeIndex={activeIndex}
        results={visibleResults}
        onClose={() => setOpen(false)}
        onChangeQuery={setQuery}
        onSelectIndex={setActiveIndex}
        onExecuteIndex={executeIndex}
      />
    </>
  );
}
