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
  initialDate?: string;
  item?: CalendarItem | null;
  projects: Project[];
  members: Member[];
  onClose: () => void;
  onSaved: (item: CalendarItem) => void;
  onDeleted?: (id: string) => void;
};

export const CHANNELS = [
  { type: "LINKEDIN", label: "LinkedIn", color: "bg-sky-500", textColor: "text-sky-700", charLimit: 3000 },
  { type: "INSTAGRAM", label: "Instagram", color: "bg-fuchsia-500", textColor: "text-fuchsia-700", charLimit: 2200 },
  { type: "TIKTOK", label: "TikTok", color: "bg-teal-500", textColor: "text-teal-700", charLimit: 300 },
  { type: "BLOG", label: "Blog", color: "bg-emerald-600", textColor: "text-emerald-700", charLimit: 10000 },
  { type: "NEWSLETTER", label: "Newsletter", color: "bg-orange-500", textColor: "text-orange-700", charLimit: 5000 },
  { type: "YOUTUBE", label: "YouTube", color: "bg-red-600", textColor: "text-red-700", charLimit: 5000 },
  { type: "WEBSITE", label: "Website", color: "bg-slate-600", textColor: "text-slate-700", charLimit: 2000 },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Szkic" },
  { value: "review", label: "Do recenzji" },
  { value: "approved", label: "Zatwierdzony" },
  { value: "scheduled", label: "Zaplanowany" },
  { value: "published", label: "Opublikowany" },
];

type ActivePanel = "compose" | "ai-text" | "ai-image" | "seo" | "schedule";

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

function quickDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

const QUICK_DATES = [
  { label: "Dzisiaj", offset: 0 },
  { label: "Jutro", offset: 1 },
  { label: "Za tydzien", offset: 7 },
  { label: "Za 2 tyg.", offset: 14 },
  { label: "Za miesiac", offset: 30 },
];

const BASE = "https://content-control-tower-new.vercel.app";

const SIDE_ITEMS: { id: ActivePanel; icon: string; label: string }[] = [
  { id: "compose", icon: "", label: "Komponuj" },
  { id: "ai-text", icon: "", label: "AI Tekst" },
  { id: "ai-image", icon: "", label: "AI Obraz" },
  { id: "seo", icon: "", label: "SEO & Tagi" },
  { id: "schedule", icon: "", label: "Planuj" },
];

export function PostComposerModal({
  workspaceSlug, open, initialDate, item, projects, members, onClose, onSaved, onDeleted,
}: Props) {
  const isEditing = !!item;
  const parsed = parseTags(item?.tags ?? null);

  const [activePanel, setActivePanel] = useState<ActivePanel>("compose");
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
    item?.dueAt ? toLocalDatetimeValue(item.dueAt) : initialDate ? `${initialDate}T10:00` : ""
  );
  const [status, setStatus] = useState(item?.status?.toLowerCase() ?? "draft");
  const [assignedToUserId, setAssignedToUserId] = useState(item?.assignedToUser?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Project context auto-load
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectLoaded, setProjectLoaded] = useState(false);
  const [projectContext, setProjectContext] = useState<{ toneOfVoice?: string; audience?: string; summary?: string }>({});
  const prevProjectIdRef = useRef("");

  // AI text
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState("");

  // AI image
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgFormat, setImgFormat] = useState<"square" | "landscape" | "portrait">("landscape");
  const [imgGenerating, setImgGenerating] = useState(false);
  const [imgError, setImgError] = useState("");
  const [imgPreview, setImgPreview] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);

  const selectedChannel = CHANNELS.find((c) => c.type === channelType) ?? CHANNELS[0]!;

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
    setDueAt(item?.dueAt ? toLocalDatetimeValue(item.dueAt) : initialDate ? `${initialDate}T10:00` : "");
    setStatus(item?.status?.toLowerCase() ?? "draft");
    setAssignedToUserId(item?.assignedToUser?.id ?? "");
    setError(""); setAiResult(""); setImgPreview("");
    setProjectLoaded(false); setActivePanel("compose");
    setProjectContext({});
  }, [item, initialDate]);

  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 100);
  }, [open]);

  // Load project defaults when projectId changes
  useEffect(() => {
    if (!projectId || projectLoaded || prevProjectIdRef.current === projectId) return;
    prevProjectIdRef.current = projectId;
    setProjectLoading(true);
    const load = async () => {
      try {
        const res = await fetch(`${BASE}/api/w/${workspaceSlug}/calendar/project-context/${projectId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { hashtags?: string[]; seoKeywords?: string[]; internalLinks?: string[]; toneOfVoice?: string; audience?: string; summary?: string };
        if (data.hashtags?.length) setHashtags((prev) => [...new Set([...prev, ...data.hashtags!])]);
        if (data.seoKeywords?.length) setSeoKeywords((prev) => [...new Set([...prev, ...data.seoKeywords!])]);
        if (data.internalLinks?.length) setInternalLinks((prev) => [...new Set([...prev, ...data.internalLinks!])]);
        setProjectContext({ toneOfVoice: data.toneOfVoice, audience: data.audience, summary: data.summary });
        setProjectLoaded(true);
      } finally { setProjectLoading(false); }
    };
    void load();
  }, [projectId, workspaceSlug, projectLoaded]);

  function addChip(list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) {
    const val = input.trim().replace(/^#/, "");
    if (val && !list.includes(val)) setList([...list, val]);
    setInput("");
  }

  function removeChip(list: string[], setList: (v: string[]) => void, val: string) {
    setList(list.filter((v) => v !== val));
  }

  async function generateAiText() {
    if (!title.trim() && !aiPrompt.trim()) { setAiError("Podaj tytul lub opis tematu"); return; }
    setAiGenerating(true); setAiError(""); setAiResult("");
    try {
      const res = await fetch(`${BASE}/api/w/${workspaceSlug}/calendar/ai-generate`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: aiPrompt.trim() || title.trim(), channel: channelType, hashtags, seoKeywords, internalLinks, currentBody: bodyText, ...projectContext }),
      });
      const data = (await res.json()) as { body?: string; error?: string };
      if (!res.ok) { setAiError(data.error ?? "Blad generowania"); } else { setAiResult(data.body ?? ""); }
    } finally { setAiGenerating(false); }
  }

  async function generateAiImage() {
    if (!imgPrompt.trim()) { setImgError("Opisz obraz"); return; }
    setImgGenerating(true); setImgError(""); setImgPreview("");
    try {
      const res = await fetch(`${BASE}/api/w/${workspaceSlug}/calendar/ai-image`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imgPrompt, format: imgFormat }),
      });
      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok) { setImgError(data.error ?? "Blad generowania obrazu"); } else { setImgPreview(data.imageUrl ?? ""); }
    } finally { setImgGenerating(false); }
  }

  async function submit(submitStatus: string) {
    if (!title.trim()) { setError("Tytul jest wymagany"); setActivePanel("compose"); return; }
    setSaving(true); setError("");
    const baseUrl = `${BASE}/api/w/${workspaceSlug}/calendar/items`;
    const url = isEditing ? `${baseUrl}/${item!.id}` : baseUrl;
    const method = isEditing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method, credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, channelType, projectId: projectId || null, dueAt: dueAt || null, status: submitStatus, bodyText, hashtags, seoKeywords, internalLinks, imageUrl: imgPreview || imageUrl, assignedToUserId: assignedToUserId || null }),
      });
      const data = (await res.json()) as { item?: CalendarItem; error?: string };
      if (!res.ok) { setError(data.error ?? "Blad zapisu"); } else if (data.item) { onSaved(data.item); onClose(); }
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}/api/w/${workspaceSlug}/calendar/items/${item.id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) { onDeleted?.(item.id); onClose(); }
    } finally { setDeleting(false); }
  }

  if (!open) return null;
  const charCount = bodyText.length;
  const charLimit = selectedChannel.charLimit;
  const charOverLimit = charCount > charLimit;
  const activeImage = imgPreview || imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      <div className="flex-1 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="flex h-full w-full max-w-3xl flex-col bg-[#F8F9FC] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-5 py-3.5">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">{isEditing ? "Edytuj wpis" : "Nowy wpis"}</h2>
            {projectId && projectLoading && <p className="text-xs text-[#5B7CFA] animate-pulse">Laduje ustawienia projektu...</p>}
            {projectId && projectLoaded && !projectLoading && <p className="text-xs text-green-600">Hasztagi i slowa kluczowe z projektu zaladowane</p>}
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Zamknij"></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar nav */}
          <nav className="flex w-16 flex-col items-center gap-1 border-r border-gray-200 bg-white py-4">
            {SIDE_ITEMS.map((si) => (
              <button key={si.id} type="button" onClick={() => setActivePanel(si.id)} title={si.label}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-[9px] font-medium w-12 transition-colors
                  ${activePanel === si.id ? "bg-[#5B7CFA]/10 text-[#5B7CFA]" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}>
                <span className="text-xl leading-none">{si.icon}</span>
                <span className="leading-tight text-center">{si.label}</span>
              </button>
            ))}
          </nav>

          {/* Main scrollable */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Always-visible: channel + title + project */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map((ch) => (
                    <button key={ch.type} type="button" onClick={() => setChannelType(ch.type)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border-2
                        ${channelType === ch.type ? `border-transparent ${ch.color} text-white shadow-md` : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                      {ch.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Wewnetrzny tytul posta *" aria-label="Tytul posta"
                    className="flex-1 rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                  <select value={projectId} onChange={(e) => { setProjectId(e.target.value); prevProjectIdRef.current = ""; setProjectLoaded(false); }}
                    aria-label="Wybierz projekt"
                    className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-[#5B7CFA] focus:outline-none min-w-[130px]">
                    <option value="">Projekt...</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* COMPOSE */}
              {activePanel === "compose" && (
                <>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700" htmlFor="body-textarea">Tresc posta</label>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium ${charOverLimit ? "text-red-500" : "text-gray-400"}`}>{charCount} / {charLimit}</span>
                        <button type="button" onClick={() => setActivePanel("ai-text")}
                          className="flex items-center gap-1 rounded-lg bg-[#5B7CFA]/10 px-2.5 py-1 text-xs font-semibold text-[#5B7CFA] hover:bg-[#5B7CFA]/20">
                           Generuj AI
                        </button>
                      </div>
                    </div>
                    <textarea id="body-textarea" value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                      placeholder="Wpisz tresc lub kliknij Generuj AI..." rows={8}
                      className={`w-full resize-y rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 ${charOverLimit ? "border-red-300 focus:ring-red-100" : "border-gray-200 focus:border-[#5B7CFA] focus:ring-[#5B7CFA]/20"}`} />
                  </div>
                  {activeImage ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">Obraz</p>
                        <button type="button" onClick={() => { setImgPreview(""); setImageUrl(""); }} className="text-xs text-red-400 hover:text-red-600">Usun</button>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={activeImage} alt="Podglad" className="h-40 w-full rounded-xl object-cover" />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setActivePanel("ai-image")}
                      className="w-full rounded-2xl border-2 border-dashed border-gray-300 bg-white py-5 text-sm text-gray-400 hover:border-[#5B7CFA] hover:text-[#5B7CFA] transition-colors">
                      <span className="text-2xl block mb-1"></span>Dodaj lub wygeneruj obraz
                    </button>
                  )}
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="assignee-select">Przypisz edytora</label>
                    <select id="assignee-select" value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-[#5B7CFA] focus:outline-none">
                      <option value="">Nieprzypisany</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* AI TEXT */}
              {activePanel === "ai-text" && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5"> Generuj tresc z AI</p>
                    <p className="text-xs text-gray-500">Koszt: 3 kredyty. AI uwzgledni kanal ({selectedChannel.label}), ton glosu i slowa kluczowe projektu.</p>
                  </div>
                  {projectContext.summary && (
                    <div className="rounded-xl bg-[#5B7CFA]/5 border border-[#5B7CFA]/20 px-3 py-2.5">
                      <p className="text-xs font-medium text-[#5B7CFA] mb-0.5">Kontekst projektu</p>
                      <p className="text-xs text-gray-600 line-clamp-2">{projectContext.summary}</p>
                      {projectContext.toneOfVoice && <p className="text-xs text-gray-500 mt-1">Ton: {projectContext.toneOfVoice}</p>}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="ai-topic">Temat / co chcesz przekazac?</label>
                    <textarea id="ai-topic" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="np. Pokazujemy jak zaoszczedzic 2h dziennie na tworzeniu tresci..."
                      rows={4} className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                    <p className="mt-1.5 text-xs text-gray-400">{seoKeywords.length} slow kluczowych  {hashtags.length} hashtagow  {internalLinks.length} linkow</p>
                  </div>
                  {aiError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{aiError}</p>}
                  <button type="button" onClick={() => void generateAiText()} disabled={aiGenerating}
                    className={`w-full rounded-xl py-3 text-sm font-semibold text-white transition-all ${aiGenerating ? "bg-gray-300 cursor-not-allowed" : "bg-[#5B7CFA] hover:bg-[#4a69e8]"}`}>
                    {aiGenerating ? "Generuje..." : " Generuj tresc (3 kredyty)"}
                  </button>
                  {aiResult && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed max-h-56 overflow-y-auto">{aiResult}</pre>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setBodyText(aiResult); setActivePanel("compose"); }}
                          className="flex-1 rounded-xl bg-[#5B7CFA] py-2.5 text-sm font-semibold text-white hover:bg-[#4a69e8]">Uzyj tej tresci</button>
                        <button type="button" onClick={() => { setBodyText(bodyText + "\n\n" + aiResult); setActivePanel("compose"); }}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Dolacz</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI IMAGE */}
              {activePanel === "ai-image" && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5"> Generuj obraz z AI</p>
                    <p className="text-xs text-gray-500">Koszt: 10 kredytow. Powered by DALL-E 3.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="img-prompt">Opis obrazu</label>
                    <textarea id="img-prompt" value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
                      rows={3} placeholder="np. Nowoczesne biuro, kobieta pracuje na laptopie, jasne kolory, minimalistyczny styl"
                      className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-700">Format</p>
                    <div className="flex gap-2">
                      {([{ id: "landscape" as const, label: "Poziomy 16:9", icon: "" }, { id: "square" as const, label: "Kwadrat 1:1", icon: "" }, { id: "portrait" as const, label: "Pionowy 9:16", icon: "" }]).map((f) => (
                        <button key={f.id} type="button" onClick={() => setImgFormat(f.id)}
                          className={`flex-1 rounded-xl border-2 py-2 text-xs font-medium transition-all ${imgFormat === f.id ? "border-[#5B7CFA] bg-[#5B7CFA]/10 text-[#5B7CFA]" : "border-gray-200 bg-white text-gray-600"}`}>
                          <span className="block text-xl">{f.icon}</span>{f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {imgError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{imgError}</p>}
                  <button type="button" onClick={() => void generateAiImage()} disabled={imgGenerating}
                    className={`w-full rounded-xl py-3 text-sm font-semibold text-white transition-all ${imgGenerating ? "bg-gray-300 cursor-not-allowed" : "bg-[#5B7CFA] hover:bg-[#4a69e8]"}`}>
                    {imgGenerating ? "Generuje obraz..." : " Generuj obraz (10 kredytow)"}
                  </button>
                  {imgPreview && (
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgPreview} alt="AI obraz" className="w-full rounded-xl object-cover max-h-64" />
                      <button type="button" onClick={() => { setImageUrl(imgPreview); setActivePanel("compose"); }}
                        className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">Uzyj tego obrazu</button>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="mb-2 text-xs font-medium text-gray-500">Lub podaj wlasny URL obrazu</p>
                    <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://cdn.example.com/obraz.jpg" aria-label="URL obrazu"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none" />
                  </div>
                </div>
              )}

              {/* SEO */}
              {activePanel === "seo" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="hashtag-input">Hashtagi ({hashtags.length})</label>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {hashtags.map((h) => (
                        <span key={h} className="inline-flex items-center gap-1 rounded-full bg-[#5B7CFA]/10 px-2.5 py-1 text-xs font-medium text-[#5B7CFA]">
                          #{h}<button type="button" onClick={() => removeChip(hashtags, setHashtags, h)} aria-label={`Usun #${h}`} className="text-[#5B7CFA]/60 hover:text-[#5B7CFA]"></button>
                        </span>
                      ))}
                    </div>
                    <input id="hashtag-input" type="text" value={hashtagInput} onChange={(e) => setHashtagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); addChip(hashtags, setHashtags, hashtagInput, setHashtagInput); } }}
                      placeholder="Wpisz hashtag i nacisnij Enter"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="seo-input">Slowa kluczowe SEO ({seoKeywords.length})</label>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {seoKeywords.map((k) => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {k}<button type="button" onClick={() => removeChip(seoKeywords, setSeoKeywords, k)} aria-label={`Usun ${k}`} className="text-emerald-500 hover:text-emerald-700"></button>
                        </span>
                      ))}
                    </div>
                    <input id="seo-input" type="text" value={seoInput} onChange={(e) => setSeoInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip(seoKeywords, setSeoKeywords, seoInput, setSeoInput); } }}
                      placeholder="np. content marketing, strategia tresci"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="link-input">Linkowanie wewnetrzne ({internalLinks.length})</label>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {internalLinks.map((l) => (
                        <span key={l} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                          <span className="max-w-[160px] truncate">{l}</span>
                          <button type="button" onClick={() => removeChip(internalLinks, setInternalLinks, l)} aria-label="Usun link" className="text-orange-500 hover:text-orange-700"></button>
                        </span>
                      ))}
                    </div>
                    <input id="link-input" type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (linkInput.trim()) { setInternalLinks([...internalLinks, linkInput.trim()]); setLinkInput(""); } } }}
                      placeholder="https://twoja-strona.pl/artykul"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm placeholder-gray-400 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                  </div>
                </div>
              )}

              {/* SCHEDULE */}
              {activePanel === "schedule" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                    <p className="text-sm font-semibold text-gray-900">Zaplanuj publikacje</p>
                    <div>
                      <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Szybki wybor</p>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_DATES.map((qd) => (
                          <button key={qd.label} type="button" onClick={() => setDueAt(quickDate(qd.offset))}
                            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${dueAt.startsWith(quickDate(qd.offset).slice(0, 10)) ? "border-[#5B7CFA] bg-[#5B7CFA]/10 text-[#5B7CFA]" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"}`}>
                            {qd.label}
                          </button>
                        ))}
                        <button type="button" onClick={() => setDueAt("")} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-400 hover:border-gray-300">Wyczysc</button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-500 uppercase tracking-wide" htmlFor="schedule-datetime">Data i godzina</label>
                      <input id="schedule-datetime" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-[#5B7CFA] focus:outline-none focus:ring-2 focus:ring-[#5B7CFA]/20" />
                    </div>
                    {dueAt && (
                      <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3">
                        <p className="text-xs font-semibold text-indigo-700 mb-0.5">Zaplanowano na:</p>
                        <p className="text-sm text-indigo-900 font-medium">
                          {new Date(dueAt).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-indigo-500 mt-1">Kanal: {selectedChannel.label}</p>
                      </div>
                    )}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="status-select">Status</label>
                    <select id="status-select" value={status} onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-[#5B7CFA] focus:outline-none">
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-white px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                {isEditing ? (
                  <button type="button" onClick={handleDelete} disabled={deleting}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50">
                    {deleting ? "..." : "Usun"}
                  </button>
                ) : <span />}
                <div className="flex items-center gap-2 text-xs text-gray-400 overflow-hidden flex-1 justify-center">
                  {dueAt && <span className="rounded-lg bg-indigo-50 px-2 py-1 text-indigo-600 font-medium whitespace-nowrap">{new Date(dueAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</span>}
                  {activeImage && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600 font-medium"></span>}
                  {hashtags.length > 0 && <span className="rounded-lg bg-[#5B7CFA]/10 px-2 py-1 text-[#5B7CFA] font-medium">#{hashtags.length}</span>}
                  {seoKeywords.length > 0 && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-600 font-medium">SEO {seoKeywords.length}</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void submit("draft")} disabled={saving}
                    className="rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Szkic</button>
                  <button type="button" onClick={() => void submit("scheduled")} disabled={saving}
                    className="rounded-xl border border-[#5B7CFA] bg-white px-3.5 py-2.5 text-sm font-medium text-[#5B7CFA] hover:bg-[#5B7CFA]/5 disabled:opacity-50">Zaplanuj</button>
                  <button type="button" onClick={() => void submit("published")} disabled={saving}
                    className="rounded-xl bg-[#5B7CFA] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a69e8] disabled:opacity-50">
                    {saving ? "..." : "Opublikuj"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
