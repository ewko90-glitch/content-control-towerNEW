import type { HTMLAttributes } from "react";

import { cn } from "@/styles/cn";

type AlertVariant = "success" | "warning" | "danger" | "info";

const variantClasses: Record<AlertVariant, string> = {
  success: "border-success bg-success/30 text-text",
  warning: "border-warning bg-warning/35 text-text",
  danger: "border-danger bg-danger/25 text-text",
  info: "border-primary/30 bg-primarySoft text-text",
};

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
};

export function Alert({ variant = "info", className, ...props }: AlertProps) {
  return <div role="alert" className={cn("rounded-xl border px-3 py-2 text-sm", variantClasses[variant], className)} {...props} />;
}
