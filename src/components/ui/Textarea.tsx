"use client";

import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/styles/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  autoResize?: boolean;
};

export function Textarea({ id, label, hint, error, autoResize = false, className, onInput, ...props }: TextareaProps) {
  const textareaId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={textareaId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}

      <textarea
        id={textareaId}
        className={cn(
          "min-h-[120px] w-full rounded-xl border bg-surface2 px-3 py-2.5 text-sm text-text placeholder:text-muted transition-all duration-fast ease-base outline-none",
          error ? "border-danger/80" : "border-border",
          "focus:border-primary focus:ring-2 focus:ring-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        onInput={(event) => {
          if (autoResize) {
            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
          }
          onInput?.(event);
        }}
        aria-describedby={hint || error ? `${textareaId}-meta` : undefined}
        {...props}
      />

      {error ? (
        <p id={`${textareaId}-meta`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${textareaId}-meta`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
