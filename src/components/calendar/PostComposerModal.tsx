"use client";

import { useEffect, useRef, useState } from "react";

export type CalendarItem = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  tags: string | null;
  channel: { id: string; name: string; type: string } | null;
  project: { id: string; name: string } | null;
  currentVersion: { body: string } | null;
  assignedToUser: { id: string; name: string | null; email: string } | null;
};

type Project = { id: string; name: string };
type Member = { id: string; name: string | null; email: string };

type Props = {
  workspaceSlug: string;
  open: boolean;
  initialDate?: string; // ISO date like "2026-02-20"
  item?: CalendarItem | null;
  projects: Project[];
  members: Member[];
  onClose: () => void;
  onSaved: (item: CalendarItem) => void;
  onDeleted?: (id: string) => void;
};

const CHANNELS = [
  { type: "LINKEDIN", label: "LinkedIn", color: "bg-sky-500", textColor: "text-sky-700", ringColor: "ring-sky-400" },
  { type: "INSTAGRAM", label: "Instagram", color: "bg-fuchsia-500", textColor: "text-fuchsia-700", ringColor: "ring-fuchsia-400" },
  { type: "TIKTOK", label: "TikTok", color: "bg-teal-500", textColor: "text-teal-700", ringColor: "ring-teal-400" },
  { type: "BLOG", label: "Blog", color: "bg-emerald-500", textColor: "text-emerald-700", ringColor: "ring-emerald-400" },
  { type: "NEWSLETTER", label: "Newsletter", color: "bg-orange-500", textColor: "text-orange-700", ringColor: "ring-orange-400" },
  { type: "YOUTUBE", label: "YouTube", color: "bg-red-500", textColor: "text-red-700", ringColor: "ring-red-400" },
  { type: "WEBSITE", label: "Website", color: "bg-slate-500", textColor: "text-slate-700", ringColor: "ring-slate-400" },
];

function parseTags(raw: string | null) {
  try {
    return JSON.parse(raw ?? "{}") as {
      hashtags?: string[];
      seoKeywords?: string[];
      internalLinks?: string[];
      imageUrl?: string;
    };
  } catch {
    return {};
  }
}

function toLocalDatetimeValue(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostComposerModal({ workspaceSlug, open, initialDate, item, projects, members, onClose, onSaved, onDeleted }: Props) {
  const isEditing = !!item;
  const parsed = parseTags(item?.tags ?? null);

  const [title, setTitle] = useState(item?.title ?? "");
  const [channelType, setChannelType] = useState(item?.channel?.type ?? "LINKEDIN");
  const [projectId, setProjectId] = useState(item?.project?.id ?? "");
  const [bodyText, setBodyText] = useState(item?.currentVersion?.body ?? "");
  const [hashtags, setHashtags] = useState<string[]>(parsed.hashtags ?? []);
  const [hashtagInput, setHashtagInput] = useState("");
  const [seoKeywords, setSeoKeywords] = useState<string[]>(parsed.seoKeywords ?? []);
  const [seoInput, setSeoInput] = useState("");
  const [internalLinks, setInternalLinks] = useState<string[]>(parsed.internalLinks ?? []);
  const [linkInput, setLinkInput] = useState("");
  const [imageUrl, setImageUrl] = useState(parsed.imageUrl ?? "");
  const [dueAt, setDueAt] = useState(
    item?.dueAt
      ? toLocalDatetimeValue(item.dueAt)
      : initialDate
        ? `${initialDate}T10:00`
        : ""
  );
  const [assignedToUserId, setAssignedToUserId] = useState(item?.assignedToUser?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset when item/initialDate changes
  useEffect(() => {
    const p = parseTags(item?.tags ?? null);
    setTitle(item?.title ?? "");
    setChannelType(item?.channel?.type ?? "LINKEDIN");
    setProjectId(item?.project?.id ?? "");
    setBodyText(item?.currentVersion?.body ?? "");
    setHashtags(p.hashtags ?? []);
    setSeoKeywords(p.seoKeywords ?? []);
    setInternalLinks(p.internalLinks ?? []);
    setImageUrl(p.imageUrl ?? "");
    setDueAt(
      item?.dueAt
        ? toLocalDatetimeValue(item.dueAt)
        : initialDate
          ? `${initialDate}T10:00`
          : ""
    );
    setAssignedToUserId(item?.assignedToUser?.id ?? "");
    setError("");
  }, [item, initialDate]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]);

  function addChip(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
    const val = input.trim().replace(/^#/, "");
    if (val && !list.includes(val)) setList([...list, val]);
    setInput("");
  }

  function removeChip(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.filter((v) => v !== val));
  }

  async function submit(status: "draft" | "scheduled" | "published") {
    if (!title.trim()) {
      setError("Tytuł jest wymagany");
      return;
    }
    setSaving(true);
    setError("");
    const baseUrl = `https://content-control-tower-new.vercel.app/api/w/${workspaceSlug}/calendar/items`;
    const url = isEditing ? `${baseUrl}/${item!.id}` : baseUrl;
    const method = isEditing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          channelType,
          projectId: projectId || null,
          dueAt: dueAt || null,
          status,
          bodyText,
          hashtags,
          seoKeywords,
          internalLinks,
          imageUrl,
          assignedToUserId: assignedToUserId || null,
        }),
      });
      const data = (await res.json()) as { item?: CalendarItem; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Błąd zapisu");
      } else if (data.item) {
        onSaved(data.item);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `https://content-control-tower-new.vercel.app/api/w/${workspaceSlug}/calendar/items/${item.id}`,
        { method: "DELETE", credentials: "include" }
      );
      if (res.ok) {
        onDeleted?.(item.id);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!open) return null;

  const charCount = bodyText.length;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer panel */}
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edytuj wpis" : "Nowy wpis w kalendarzu"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-title">
              Wewnętrzny tytuł <span className="text-red-500">*</span>
            </label>
            <input
              ref={titleRef}
              id="composer-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Post o nowej ofercie — IG maj"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Channel selector */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Kanał publikacji</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.type}
                  type="button"
                  onClick={() => setChannelType(ch.type)}
                  className={`rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-all ${
                    channelType === ch.type
                      ? `border-transparent ${ch.color} text-white shadow-md`
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700" htmlFor="composer-body">
                Treść posta
              </label>
              <span className={`text-xs ${charCount > 2000 ? "text-red-500" : "text-gray-400"}`}>
                {charCount} znaków
              </span>
            </div>
            <textarea
              id="composer-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Napisz treść posta... Pamiętaj o mocnym CTA i wartości dla odbiorcy."
              rows={6}
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-hashtags">
              Hashtagi
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {hashtags.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 rounded-full bg-[#5B7CFA]/10 px-2.5 py-1 text-xs font-medium text-[#5B7CFA]">
                  #{h}
                  <button type="button" onClick={() => removeChip(hashtags, setHashtags, h)} className="text-[#5B7CFA]/60 hover:text-[#5B7CFA]">✕</button>
                </span>
              ))}
            </div>
            <input
              id="composer-hashtags"
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "," || e.key === " ") {
                  e.preventDefault();
                  addChip(hashtags, setHashtags, hashtagInput, setHashtagInput);
                }
              }}
              placeholder="Wpisz hashtag i naciśnij Enter"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* SEO Keywords */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-seo">
              Słowa kluczowe SEO
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {seoKeywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {k}
                  <button type="button" onClick={() => removeChip(seoKeywords, setSeoKeywords, k)} className="text-emerald-500 hover:text-emerald-700">✕</button>
                </span>
              ))}
            </div>
            <input
              id="composer-seo"
              type="text"
              value={seoInput}
              onChange={(e) => setSeoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addChip(seoKeywords, setSeoKeywords, seoInput, setSeoInput);
                }
              }}
              placeholder="np. marketing treści, content marketing"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Internal links */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-links">
              Linkowanie wewnętrzne
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {internalLinks.map((l) => (
                <span key={l} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                  <span className="max-w-[180px] truncate">{l}</span>
                  <button type="button" onClick={() => removeChip(internalLinks, setInternalLinks, l)} className="text-orange-500 hover:text-orange-700">✕</button>
                </span>
              ))}
            </div>
            <input
              id="composer-links"
              type="url"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (linkInput.trim()) {
                    setInternalLinks([...internalLinks, linkInput.trim()]);
                    setLinkInput("");
                  }
                }
              }}
              placeholder="https://twoja-strona.pl/blog/artykul"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-image">
              URL obrazu / grafiki
            </label>
            {imageUrl && (
              <div className="mb-2 h-24 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Podgląd" className="h-full w-full object-cover" />
              </div>
            )}
            <input
              id="composer-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://cdn.example.com/obraz.jpg"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {/* Project + Assignee row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-project">
                Projekt
              </label>
              <select
                id="composer-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
              >
                <option value="">— Bez projektu —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-assignee">
                Przypisz edytora
              </label>
              <select
                id="composer-assignee"
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
              >
                <option value="">— Nieprzypisany —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name ?? m.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="composer-date">
              Data i godzina publikacji
            </label>
            <input
              id="composer-date"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {deleting ? "Usuwanie..." : "Usuń wpis"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void submit("draft")}
                disabled={saving}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? "..." : "Zapisz szkic"}
              </button>
              <button
                type="button"
                onClick={() => void submit("scheduled")}
                disabled={saving}
                className="rounded-xl border border-[#5B7CFA] bg-white px-4 py-2.5 text-sm font-medium text-[#5B7CFA] hover:bg-[#5B7CFA]/5 disabled:opacity-50"
              >
                {saving ? "..." : "Zaplanuj"}
              </button>
              <button
                type="button"
                onClick={() => void submit("published")}
                disabled={saving}
                className="rounded-xl bg-[#5B7CFA] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#4a69e8] disabled:opacity-50"
              >
                {saving ? "Zapisuję..." : "Opublikuj teraz"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
