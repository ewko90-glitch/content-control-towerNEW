import type { SelectHTMLAttributes } from "react";

import { cn } from "@/styles/cn";

type DropdownOption = {
  value: string;
  label: string;
};

type DropdownProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  hint?: string;
  error?: string;
  options: DropdownOption[];
};

export function Dropdown({ id, label, hint, error, className, options, ...props }: DropdownProps) {
  const selectId = id ?? props.name;

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-sm font-medium text-text">
          {label}
        </label>
      ) : null}

      <select
        id={selectId}
        className={cn(
          "h-11 w-full rounded-xl border bg-surface2 px-3 text-sm text-text outline-none transition-all duration-fast ease-base",
          error ? "border-danger/80" : "border-border",
          "focus:border-primary focus:ring-2 focus:ring-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        aria-describedby={hint || error ? `${selectId}-meta` : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={`${selectId}-meta`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-meta`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
