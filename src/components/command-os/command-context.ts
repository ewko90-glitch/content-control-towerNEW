"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadDecisionStore } from "@/components/decision-intelligence/decision-storage";
import { DEFAULT_OVERRIDES } from "@/components/decision-lab/decision-lab-state";
import { encodeDecisionLabState } from "@/components/decision-lab/decision-lab-url";
import { useCommandProvider } from "@/components/command-os/command-provider";
import { deriveCommandContext } from "./command-intelligence";

type CommandContextBridgeProps = {
  workspaceSlug?: string;
  workflowSignals?: unknown;
  predictiveRisk?: unknown;
  flowMetrics?: unknown;
};

function presetToDecisionLabState(preset?: string): string | null {
  if (!preset) {
    return null;
  }

  if (preset === "cap_up_20") {
    return encodeDecisionLabState({
      presetId: "cap_up_bottleneck_20",
      knobsOverrides: {
        ...DEFAULT_OVERRIDES,
      },
    });
  }

  if (preset === "last_used") {
    return null;
  }

  return null;
}

function openDecisionLabFromPage(): void {
  const anchor = document.getElementById("decision-lab-anchor");
  if (!anchor) {
    return;
  }

  const button = anchor.querySelector("button");
  if (button instanceof HTMLButtonElement) {
    button.click();
  }
}

export function CommandContextBridge(props: CommandContextBridgeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setRuntimeContext } = useCommandProvider();

  const context = useMemo(
    () =>
      deriveCommandContext({
        pathname,
        workspaceSlug: props.workspaceSlug,
        workflowSignals: props.workflowSignals,
        predictiveRisk: props.predictiveRisk,
        flowMetrics: props.flowMetrics,
      }),
    [pathname, props.workspaceSlug, props.workflowSignals, props.predictiveRisk, props.flowMetrics],
  );

  useEffect(() => {
    setRuntimeContext(context);
  }, [context, setRuntimeContext]);

  useEffect(() => {
    const workspaceSlug = props.workspaceSlug;

    if (!workspaceSlug) {
      setRuntimeContext({
        ...context,
        hasDecisionEntries: false,
        hasCurrentStrategy: false,
        latestDecisionId: undefined,
      });
      return;
    }

    const applyDecisionContext = () => {
      try {
        const store = loadDecisionStore(workspaceSlug);
        setRuntimeContext({
          ...context,
          hasDecisionEntries: store.entries.length > 0,
          hasCurrentStrategy: Boolean(store.currentStrategyId),
          latestDecisionId: store.entries[0]?.id,
        });
      } catch {
        setRuntimeContext({
          ...context,
          hasDecisionEntries: false,
          hasCurrentStrategy: false,
          latestDecisionId: undefined,
        });
      }
    };

    applyDecisionContext();

    const onUpdate = () => {
      applyDecisionContext();
    };

    window.addEventListener("cct:decision:updated", onUpdate as EventListener);
    return () => {
      window.removeEventListener("cct:decision:updated", onUpdate as EventListener);
    };
  }, [context, props.workspaceSlug, setRuntimeContext]);

  useEffect(() => {
    const command = searchParams.get("cmd");
    if (command !== "openDecisionLab") {
      return;
    }

    const current = new URLSearchParams(searchParams.toString());
    const dlEncoded = presetToDecisionLabState(current.get("preset") ?? undefined);

    if (dlEncoded) {
      current.set("dl", dlEncoded);
    }

    current.delete("cmd");
    current.delete("preset");

    router.replace(current.toString().length > 0 ? `${pathname}?${current.toString()}` : pathname, { scroll: false });

    window.setTimeout(() => {
      openDecisionLabFromPage();
    }, 20);
  }, [pathname, router, searchParams]);

  return null;
}
