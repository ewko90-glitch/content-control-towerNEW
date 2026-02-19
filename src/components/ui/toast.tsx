"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { cn } from "@/styles/cn";

type ToastVariant = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (variant: ToastVariant, message: string) => void;
};

const listeners = new Set<(variant: ToastVariant, message: string) => void>();

export const toast = {
  success(message: string) {
    listeners.forEach((listener) => listener("success", message));
  },
  error(message: string) {
    listeners.forEach((listener) => listener("error", message));
  },
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (variant: ToastVariant, message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, 3500);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      push(variant, message) {
        const id = `${Date.now()}-${Math.random()}`;
        setItems((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== id));
        }, 3500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[320px] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-sm",
              item.variant === "success" ? "border-success bg-success/30 text-text" : "border-danger bg-danger/25 text-text",
            )}
            role="status"
            aria-live="polite"
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast musi być użyty wewnątrz ToastProvider.");
  }
  return context;
}
