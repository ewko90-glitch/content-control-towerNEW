import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/styles/cn";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
};

export function Input({ id, label, hint, error, leftIcon, className, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}

      <div
        className={cn(
          "flex h-11 items-center rounded-xl border bg-surface2 px-3 transition-all duration-fast ease-base",
          error ? "border-danger/80" : "border-border",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
        )}
      >
        {leftIcon ? <span className="mr-2 text-muted">{leftIcon}</span> : null}
        <input
          id={inputId}
          className={cn(
            "w-full border-0 bg-transparent text-sm text-text outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          aria-describedby={hint || error ? `${inputId}-meta` : undefined}
          {...props}
        />
      </div>

      {error ? (
        <p id={`${inputId}-meta`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-meta`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
