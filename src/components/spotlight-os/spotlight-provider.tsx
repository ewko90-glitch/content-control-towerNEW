"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { deriveSpotlightFlow } from "./spotlight-engine";
import { SpotlightOverlay } from "./spotlight-overlay";
import { readSpotlightState, restartSpotlight, writeSpotlightState } from "./spotlight-storage";
import type { SpotlightFlowInput, SpotlightStep } from "./spotlight-types";

type SpotlightProviderProps = SpotlightFlowInput;

function sessionDecisionLabKey(workspaceSlug: string): string {
  return `cct:spotlight:dl-ran:${workspaceSlug}`;
}

function readDecisionLabSession(workspaceSlug: string): boolean {
  try {
    return window.sessionStorage.getItem(sessionDecisionLabKey(workspaceSlug)) === "1";
  } catch {
    return false;
  }
}

function markDecisionLabSession(workspaceSlug: string): void {
  try {
    window.sessionStorage.setItem(sessionDecisionLabKey(workspaceSlug), "1");
  } catch {
    return;
  }
}

export function SpotlightProvider(props: SpotlightProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [decisionLabRanSession, setDecisionLabRanSession] = useState(false);

  useEffect(() => {
    try {
      const ran = readDecisionLabSession(props.workspaceSlug);
      setDecisionLabRanSession(ran);
    } catch {
      setOpen(false);
    }
  }, [props.workspaceSlug]);

  useEffect(() => {
    try {
      if (searchParams.get("dlRun")) {
        markDecisionLabSession(props.workspaceSlug);
        setDecisionLabRanSession(true);
      }
    } catch {
      setOpen(false);
    }
  }, [searchParams, props.workspaceSlug]);

  const flow = useMemo(
    () =>
      deriveSpotlightFlow({
        ...props,
        decisionLabReady: props.decisionLabReady && !decisionLabRanSession,
      }),
    [props, decisionLabRanSession],
  );

  const activeStep: SpotlightStep | null = flow.steps[stepIndex] ?? null;

  useEffect(() => {
    try {
      const stored = readSpotlightState(props.workspaceSlug);
      if (stored.status === "dismissed" || stored.status === "completed") {
        setOpen(false);
        return;
      }

      if (flow.totalSteps === 0) {
        writeSpotlightState(props.workspaceSlug, { status: "completed", stepIndex: 0 });
        setOpen(false);
        return;
      }

      const safeStep = Math.min(stored.stepIndex, Math.max(0, flow.totalSteps - 1));
      setStepIndex(safeStep);
      setOpen(true);
    } catch {
      setOpen(false);
    }
  }, [flow.totalSteps, props.workspaceSlug]);

  useEffect(() => {
    const handler = () => {
      try {
        const restarted = restartSpotlight(props.workspaceSlug);
        setStepIndex(restarted.stepIndex);
        setOpen(true);
      } catch {
        setOpen(false);
      }
    };

    window.addEventListener("cct:spotlight:restart", handler as EventListener);
    return () => {
      window.removeEventListener("cct:spotlight:restart", handler as EventListener);
    };
  }, [props.workspaceSlug]);

  function dismissSilently() {
    try {
      writeSpotlightState(props.workspaceSlug, { status: "dismissed", stepIndex });
    } catch {
      return;
    } finally {
      setOpen(false);
    }
  }

  function completeFlow() {
    try {
      writeSpotlightState(props.workspaceSlug, { status: "completed", stepIndex: flow.totalSteps });
    } catch {
      return;
    } finally {
      setOpen(false);
    }
  }

  function goBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    setStepIndex((current) => {
      const next = current + 1;
      if (next >= flow.totalSteps) {
        completeFlow();
        return current;
      }

      void writeSpotlightState(props.workspaceSlug, { status: "active", stepIndex: next });
      return next;
    });
  }

  function openDecisionLab() {
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("cmd", "openDecisionLab");
      params.set("preset", "cap_up_20");
      router.push(`${pathname}?${params.toString()}`);
      markDecisionLabSession(props.workspaceSlug);
      setDecisionLabRanSession(true);
      window.requestAnimationFrame(() => {
        goNext();
      });
    } catch {
      dismissSilently();
    }
  }

  function openCommandOS() {
    try {
      window.dispatchEvent(new CustomEvent("cct:command-os:open"));
      goNext();
    } catch {
      dismissSilently();
    }
  }

  function onPrimary() {
    try {
      if (!activeStep) {
        completeFlow();
        return;
      }

      if (activeStep.action === "openDecisionLab") {
        openDecisionLab();
        return;
      }

      if (activeStep.action === "openCommandOS") {
        openCommandOS();
        return;
      }

      goNext();
    } catch {
      dismissSilently();
    }
  }

  return (
    <SpotlightOverlay
      open={open}
      step={activeStep}
      stepIndex={stepIndex}
      totalSteps={flow.totalSteps}
      onPrimary={onPrimary}
      onBack={goBack}
      onSkip={dismissSilently}
      onDismiss={dismissSilently}
    />
  );
}
