"use client";

import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { spotlightCopy } from "./spotlight-copy";
import type { SpotlightStep } from "./spotlight-types";

type SpotlightTooltipProps = {
  open: boolean;
  step: SpotlightStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onPrimary: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDismiss: () => void;
};

function computePlacement(targetRect: DOMRect | null): { top: number; left: number } {
  const width = 380;
  const margin = 16;
  if (typeof window === "undefined") {
    return { top: margin, left: margin };
  }

  if (!targetRect) {
    return {
      top: Math.max(margin, window.innerHeight / 2 - 140),
      left: Math.max(margin, window.innerWidth / 2 - width / 2),
    };
  }

  const preferredLeft = targetRect.left + targetRect.width / 2 - width / 2;
  const clampedLeft = Math.min(Math.max(margin, preferredLeft), window.innerWidth - width - margin);
  const belowTop = targetRect.bottom + 14;
  const aboveTop = targetRect.top - 198;

  if (belowTop + 190 <= window.innerHeight - margin) {
    return { top: belowTop, left: clampedLeft };
  }

  if (aboveTop >= margin) {
    return { top: aboveTop, left: clampedLeft };
  }

  return {
    top: Math.max(margin, window.innerHeight / 2 - 140),
    left: Math.max(margin, window.innerWidth / 2 - width / 2),
  };
}

export function SpotlightTooltip(props: SpotlightTooltipProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const placement = useMemo(() => computePlacement(props.targetRect), [props.targetRect]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    element.style.top = `${placement.top}px`;
    element.style.left = `${placement.left}px`;
  }, [placement]);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
    ).filter((node) => !node.hasAttribute("disabled"));

    focusables[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!props.open) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        props.onDismiss();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          props.onBack();
        } else {
          props.onPrimary();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const host = containerRef.current;
      if (!host) {
        event.preventDefault();
        return;
      }

      const nodes = Array.from(
        host.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
      ).filter((node) => !node.hasAttribute("disabled"));

      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!active || active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [props]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={spotlightCopy.title}
      className={`fixed z-[140] w-[min(92vw,380px)] rounded-2xl border border-border bg-surface2 p-4 shadow-soft transition-all duration-150 ${
        props.open ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
        {spotlightCopy.stepLabel} {props.stepIndex + 1} {spotlightCopy.ofLabel} {props.totalSteps}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-text">{props.step.title}</h3>
      <p className="mt-2 text-sm text-textMuted">{props.step.body}</p>
      <p className="mt-3 rounded-xl bg-bg/60 px-3 py-2 text-xs text-textMuted">{props.step.why}</p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {props.stepIndex > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={props.onBack}>
              {spotlightCopy.back}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={props.onSkip}>
            {props.step.secondaryLabel}
          </Button>
        </div>
        <Button type="button" size="sm" onClick={props.onPrimary}>
          {props.step.primaryLabel}
        </Button>
      </div>
    </div>
  );
}
