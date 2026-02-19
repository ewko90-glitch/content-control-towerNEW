"use client";

import { useState } from "react";

type NewPublicationModalProps = {
  channels: Array<{ value: "wordpress" | "shopify" | "linkedin" | "inne"; label: string }>;
  onCreate: (formData: FormData) => void;
};

export function NewPublicationModal({ channels, onCreate }: NewPublicationModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5B7CFA] px-4 text-sm font-medium text-white"
      >
        + Dodaj publikację
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
            <h3 className="text-base font-semibold text-[#0F172A]">Nowa publikacja</h3>
            <form
              action={(formData) => {
                onCreate(formData);
                setOpen(false);
              }}
              className="mt-4 space-y-3"
            >
              <input name="tytul" required placeholder="Tytuł" className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm" />

              <div className="grid gap-3 md:grid-cols-2">
                <select title="Kanał publikacji" name="kanal" defaultValue={channels[0]?.value ?? "inne"} className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm">
                  {channels.map((channel) => (
                    <option key={channel.value + channel.label} value={channel.value}>{channel.label}</option>
                  ))}
                </select>
                <select title="Typ publikacji" name="typ" defaultValue="post" className="h-10 rounded-xl border border-[#E2E8F0] px-3 text-sm">
                  <option value="blog">blog</option>
                  <option value="post">post</option>
                  <option value="newsletter">newsletter</option>
                  <option value="landing">landing</option>
                  <option value="inne">inne</option>
                </select>
              </div>

              <input type="date" title="Data publikacji" name="dataPublikacji" required className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm" />
              <select title="Status publikacji" name="status" defaultValue="zaplanowane" className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm">
                <option value="pomysl">pomysł</option>
                <option value="szkic">szkic</option>
                <option value="do_akceptacji">do akceptacji</option>
                <option value="zaplanowane">zaplanowane</option>
                <option value="opublikowane">opublikowane</option>
              </select>
              <textarea name="opis" placeholder="Opis (opcjonalnie)" className="min-h-[90px] w-full rounded-xl border border-[#E2E8F0] p-3 text-sm" />

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-[#E2E8F0] px-4 text-sm text-[#475569]">
                  Anuluj
                </button>
                <button type="submit" className="h-10 rounded-xl bg-[#5B7CFA] px-4 text-sm font-medium text-white">
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
