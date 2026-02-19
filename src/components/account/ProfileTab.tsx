"use client";

import { useState } from "react";

type Props = {
  user: { id: string; email: string; name: string | null };
};

export function ProfileTab({ user }: Props) {
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [repeatPwd, setRepeatPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);

  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleProfileSave = async () => {
    setSaving(true);
    await fetch("https://content-control-tower-new.vercel.app/api/account/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePasswordSave = async () => {
    setPwdError("");
    if (newPwd !== repeatPwd) {
      setPwdError("Hasła się nie zgadzają.");
      return;
    }
    if (newPwd.length < 10) {
      setPwdError("Hasło musi mieć min. 10 znaków.");
      return;
    }
    const res = await fetch("https://content-control-tower-new.vercel.app/api/account/password", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setPwdError((data.error as string) ?? "Błąd zmiany hasła.");
    } else {
      setPwdSaved(true);
      setOldPwd(""); setNewPwd(""); setRepeatPwd("");
      setTimeout(() => setPwdSaved(false), 2500);
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Profil</h1>
        <p className="text-sm text-gray-500">Zarządzaj swoimi danymi osobowymi.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5B7CFA] text-xl font-bold text-white">
          {initials}
        </div>
        <div>
          <p className="font-medium text-gray-900">{user.name ?? user.email}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* Profile form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Dane konta</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
            <input
              value={user.email}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Imię i nazwisko</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>
          <button
            onClick={handleProfileSave}
            disabled={saving}
            className="rounded-xl bg-[#5B7CFA] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saved ? "Zapisano ✓" : saving ? "Zapisuję..." : "Zapisz profil"}
          </button>
        </div>
      </div>

      {/* Password form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-gray-900">Zmień hasło</h2>
        <div className="space-y-4">
          {pwdError && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{pwdError}</p>
          )}
          {pwdSaved && (
            <p className="rounded-xl bg-green-50 px-4 py-2 text-sm text-green-700">Hasło zmienione ✓</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Stare hasło</label>
            <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nowe hasło</label>
            <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Powtórz nowe hasło</label>
            <input type="password" value={repeatPwd} onChange={(e) => setRepeatPwd(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5B7CFA] focus:ring-2 focus:ring-[#5B7CFA]/20" />
          </div>
          <button onClick={handlePasswordSave}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            Zapisz hasło
          </button>
        </div>
      </div>
    </div>
  );
}
