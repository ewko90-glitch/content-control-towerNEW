"use client";

import { useEffect, useState } from "react";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("welcome_modal_seen");
    if (!seen) {
      setOpen(true);
      // Poproś o push jednocześnie z pokazaniem modalu
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("welcome_modal_seen", "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Zamknij"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>

        {/* Header */}
        <div className="border-b border-gray-100 px-7 py-5">
          <h2 className="text-center text-base font-semibold text-gray-900">
            Witaj w Social AI Studio i dziękujemy, że nam zaufałaś!
          </h2>
        </div>

        {/* Video placeholder */}
        <div className="px-7 py-6">
          <div className="flex aspect-video w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400">
            {/* Tutaj docelowo film powitalny */}
            <div className="text-center">
              <div className="mb-2 text-4xl">🎬</div>
              <p>Film powitalny</p>
              <p className="mt-1 text-xs text-gray-300">Wkrótce</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-gray-100 px-7 py-5">
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-bold text-gray-900 transition hover:bg-yellow-300 active:scale-[0.98]"
          >
            Eksploruj Social AI Studio →
          </button>
        </div>
      </div>
    </div>
  );
}
