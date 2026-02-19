import type { HTMLAttributes } from "react";

import { cn } from "@/styles/cn";

type BadgeVariant = "role" | "plan" | "status" | "credits";

const variantClasses: Record<BadgeVariant, string> = {
  role: "bg-primarySoft text-primary border-primary/30",
  plan: "bg-secondarySoft text-text border-secondary/40",
  status: "bg-accent/30 text-text border-accent/50",
  credits: "bg-surface2 text-text border-border",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "status", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
