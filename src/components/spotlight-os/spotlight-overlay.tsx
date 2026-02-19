"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveTarget, SpotlightMask } from "./spotlight-mask";
import { SpotlightTooltip } from "./spotlight-tooltip";
import type { SpotlightStep } from "./spotlight-types";

type SpotlightOverlayProps = {
  open: boolean;
  step: SpotlightStep | null;
  stepIndex: number;
  totalSteps: number;
  onPrimary: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDismiss: () => void;
};

export function SpotlightOverlay(props: SpotlightOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const selector = props.step?.selector ?? "";

  useEffect(() => {
    if (!props.open || !selector) {
      setTargetRect(null);
      return;
    }

    const refresh = () => {
      setTargetRect(resolveTarget(selector));
    };

    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);

    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [props.open, selector]);

  const safeStep = useMemo(() => props.step, [props.step]);

  if (!safeStep) {
    return null;
  }

  return (
    <>
      <SpotlightMask open={props.open} targetRect={targetRect} />
      <SpotlightTooltip
        open={props.open}
        step={safeStep}
        stepIndex={props.stepIndex}
        totalSteps={props.totalSteps}
        targetRect={targetRect}
        onPrimary={props.onPrimary}
        onBack={props.onBack}
        onSkip={props.onSkip}
        onDismiss={props.onDismiss}
      />
    </>
  );
}
