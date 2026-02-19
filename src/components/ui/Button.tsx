import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/styles/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 focus-visible:ring-focusRing",
  secondary:
    "bg-secondarySoft text-text border border-secondary/40 hover:-translate-y-0.5 hover:bg-secondarySoft/80 hover:shadow-sm active:translate-y-0 focus-visible:ring-focusRing",
  ghost:
    "bg-transparent text-text border border-border hover:-translate-y-0.5 hover:bg-surface2 hover:shadow-xs active:translate-y-0 focus-visible:ring-focusRing",
  danger:
    "bg-danger text-text border border-danger/60 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 focus-visible:ring-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-normal ease-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
          />
        </svg>
      ) : (
        leadingIcon
      )}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </button>
  );
}
