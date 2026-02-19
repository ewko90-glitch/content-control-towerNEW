"use client";

import { useEffect, useMemo, useRef } from "react";

export function resolveTarget(selector: string): DOMRect | null {
  try {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.x) || !Number.isFinite(rect.y) || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return rect;
  } catch {
    return null;
  }
}

type SpotlightMaskProps = {
  open: boolean;
  targetRect: DOMRect | null;
};

export function SpotlightMask(props: SpotlightMaskProps) {
  const holeRef = useRef<HTMLDivElement | null>(null);

  const hole = useMemo(() => {
    if (!props.targetRect) {
      return null;
    }

    const padding = 10;
    return {
      left: Math.max(8, props.targetRect.left - padding),
      top: Math.max(8, props.targetRect.top - padding),
      width: Math.max(24, props.targetRect.width + padding * 2),
      height: Math.max(24, props.targetRect.height + padding * 2),
    };
  }, [props.targetRect]);

  useEffect(() => {
    const element = holeRef.current;
    if (!element) {
      return;
    }

    if (!hole) {
      element.classList.add("hidden");
      return;
    }

    element.classList.remove("hidden");
    element.style.left = `${hole.left}px`;
    element.style.top = `${hole.top}px`;
    element.style.width = `${hole.width}px`;
    element.style.height = `${hole.height}px`;
  }, [hole]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[130] transition-opacity duration-150 ${props.open ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-0 bg-slate-950/50 transition-opacity duration-150" />
      <div
        ref={holeRef}
        className="absolute hidden rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] transition-all duration-150"
      />
    </div>
  );
}
