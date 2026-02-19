"use client";

import { useEffect, useState } from "react";

export function TrialBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("trial_banner_dismissed");
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("trial_banner_dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-yellow-300 bg-yellow-100 px-6 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-yellow-900">
        <span className="text-base">⏳</span>
        <span>
          Twój okres próbny trwa — korzystaj do woli!{" "}
          <a href="/account" className="font-bold underline underline-offset-2 hover:text-yellow-950">
            Wybierz plan →
          </a>
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zamknij"
        className="flex h-6 w-6 items-center justify-center rounded-full text-yellow-700 transition hover:bg-yellow-200"
      >
        ✕
      </button>
    </div>
  );
}
