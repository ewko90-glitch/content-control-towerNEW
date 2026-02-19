"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CommandAction, CommandContext } from "./command-types";

type CommandProviderValue = {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  runtimeContext: CommandContext;
  setRuntimeContext: (next: CommandContext) => void;
  runAction: (action: CommandAction) => void;
};

const CommandProviderContext = createContext<CommandProviderValue | null>(null);

function parseWorkspaceSlug(pathname: string): string | undefined {
  const match = pathname.match(/\/w\/([^/]+)/);
  return match?.[1];
}

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return target.isContentEditable;
}

export function CommandProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultContext = useMemo<CommandContext>(
    () => ({
      pathname,
      workspaceSlug: parseWorkspaceSlug(pathname),
      isContentPage: pathname.includes("/content"),
      highRisk: false,
      bottleneckStage: undefined,
      hasSignals: false,
      hasDecisionLab: Boolean(parseWorkspaceSlug(pathname)),
      hasDecisionEntries: false,
      hasCurrentStrategy: false,
      latestDecisionId: undefined,
    }),
    [pathname],
  );

  const [runtimeContext, setRuntimeContext] = useState<CommandContext>(defaultContext);

  useEffect(() => {
    setRuntimeContext((current) => ({
      ...current,
      pathname,
      workspaceSlug: current.workspaceSlug ?? parseWorkspaceSlug(pathname),
      isContentPage: pathname.includes("/content"),
      hasDecisionLab: current.hasDecisionLab || Boolean(parseWorkspaceSlug(pathname)),
    }));
  }, [pathname]);

  const runAction = useCallback(
    (action: CommandAction) => {
      if (action.kind === "navigate") {
        router.push(action.href);
      }
      setOpen(false);
    },
    [router],
  );

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const chord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (chord) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (isTextEntryElement(event.target)) {
        return;
      }

      if (event.key === "/" && !open) {
        event.preventDefault();
        setOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const value = useMemo<CommandProviderValue>(
    () => ({
      open,
      setOpen,
      toggle,
      runtimeContext,
      setRuntimeContext,
      runAction,
    }),
    [open, toggle, runtimeContext, runAction],
  );

  return <CommandProviderContext.Provider value={value}>{children}</CommandProviderContext.Provider>;
}

export function useCommandProvider(): CommandProviderValue {
  const context = useContext(CommandProviderContext);
  if (!context) {
    throw new Error("useCommandProvider must be used within CommandProvider");
  }
  return context;
}
