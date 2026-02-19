import type { InputHTMLAttributes } from "react";

import { cn } from "@/styles/cn";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Checkbox({ id, label, hint, className, ...props }: CheckboxProps) {
  const checkboxId = id ?? props.name;

  return (
    <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-2 rounded-lg px-1 py-1">
      <input
        id={checkboxId}
        type="checkbox"
        className={cn(
          "mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30",
          className,
        )}
        {...props}
      />
      <span>
        <span className="block text-sm text-text">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
