"use client";
// account tab: notifications

import { useState } from "react";

type NotifKey = string;

const GROUPS = [
  {
    label: "Posty i publikacja",
    items: [
      { key: "post_published", label: "Post opublikowany" },
      { key: "post_scheduled", label: "Post zaplanowany" },
      { key: "post_publish_error", label: "Błąd publikacji postu" },
      { key: "post_assigned", label: "Post przypisany do mnie" },
    ],
  },
  {
    label: "Komentarze",
    items: [
      { key: "new_comment", label: "Nowy komentarz do posta" },
      { key: "comment_mention", label: "Ktoś mnie oznaczył w komentarzu" },
    ],
  },
  {
    label: "Zespół",
    items: [
      { key: "member_joined", label: "Nowa osoba dołączyła do workspace" },
      { key: "member_invited", label: "Zaproszenie do projektu" },
    ],
  },
  {
    label: "AI & limity",
    items: [
      { key: "ai_credits_low", label: "Kredyty AI poniżej 20%" },
      { key: "plan_limit_seats", label: "Limit użytkowników się kończy" },
      { key: "plan_limit_projects", label: "Limit projektów się kończy" },
    ],
  },
];

type Channel = "app" | "email" | "push";

export function NotificationsTab() {
  const [settings, setSettings] = useState<Record<NotifKey, Record<Channel, boolean>>>(() => {
    const init: Record<NotifKey, Record<Channel, boolean>> = {};
    for (const g of GROUPS) {
      for (const item of g.items) {
        init[item.key] = { app: true, email: item.key.includes("publish") || item.key.includes("error"), push: false };
      }
    }
    return init;
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: NotifKey, channel: Channel) => {
    setSettings((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key]?.[channel] },
    }));
  };

  const handleSave = async () => {
    await fetch("https://content-control-tower-new.vercel.app/api/account/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const channels: { key: Channel; label: string }[] = [
    { key: "app", label: "W aplikacji" },
    { key: "email", label: "Email" },
    { key: "push", label: "Push" },
  ];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Powiadomienia</h1>
        <p className="text-sm text-gray-500">Wybierz jak i kiedy chcesz być informowany.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white">
        {/* Header row */}
        <div className="flex items-center border-b border-gray-100 px-6 py-3">
          <div className="flex-1" />
          {channels.map((c) => (
            <div key={c.key} className="w-20 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
              {c.label}
            </div>
          ))}
        </div>

        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{group.label}</p>
            </div>
            {group.items.map((item) => (
              <div
                key={item.key}
                className="flex items-center border-b border-gray-100 px-6 py-3 last:border-0"
              >
                <div className="flex-1 text-sm text-gray-700">{item.label}</div>
                {channels.map((c) => (
                  <div key={c.key} className="flex w-20 justify-center">
                    <button
                      onClick={() => toggle(item.key, c.key)}
                      className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
                        settings[item.key]?.[c.key]
                          ? "bg-[#5B7CFA] text-white"
                          : "border-2 border-gray-300 bg-white hover:border-[#5B7CFA]"
                      }`}
                    >
                      {settings[item.key]?.[c.key] && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="rounded-xl bg-[#5B7CFA] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {saved ? "Zapisano ✓" : "Zapisz ustawienia"}
      </button>
    </div>
  );
}
