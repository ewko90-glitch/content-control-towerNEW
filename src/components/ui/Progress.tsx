import { cn } from "@/styles/cn";

type ProgressProps = {
  value: number;
  max?: number;
  className?: string;
  label?: string;
  progressClassName?: string;
};

export function Progress({ value, max = 100, className, label, progressClassName }: ProgressProps) {
  const safeValue = Math.max(0, Math.min(value, max));
  const baseProgressClass =
    "h-2 w-full overflow-hidden rounded-full bg-surface2 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-surface2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary";

  return (
    <div className={cn("space-y-1", className)}>
      {label ? <div className="text-xs text-muted">{label}</div> : null}
      <progress
        className={cn(baseProgressClass, progressClassName)}
        value={safeValue}
        max={max}
        aria-label={label ?? "Postęp"}
      />
    </div>
  );
}
