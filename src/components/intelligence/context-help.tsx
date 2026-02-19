"use client";

import { useEffect, useMemo, useState } from "react";

type ContextHelpProps = {
  id: string;
  label: string;
  lines: readonly [string, string, string] | readonly [string, string];
};

export function ContextHelp(props: ContextHelpProps) {
  const storageKey = useMemo(() => `cct:intel:help:${props.id}:dismissed`, [props.id]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(storageKey) === "1";
      if (dismissed) {
        setIsDismissed(true);
      }
    } catch {
      setIsDismissed(false);
    }
  }, [storageKey]);

  if (isDismissed) {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={props.label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface2 text-[10px] font-semibold text-textMuted"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        ?
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-7 z-20 w-64 rounded-xl border border-border bg-surface p-3 text-xs text-text shadow-soft">
          <div className="space-y-1">
            {props.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-[11px] text-textMuted underline"
            onClick={() => {
              try {
                window.localStorage.setItem(storageKey, "1");
              } catch {
              }
              setIsDismissed(true);
            }}
          >
            Ukryj podpowiedź
          </button>
        </div>
      ) : null}
    </div>
  );
}
