"use client";

import { useCallback, useEffect, useState } from "react";

import { type CalendarItem, PostComposerModal } from "./PostComposerModal";

type Project = { id: string; name: string };
type Member = { id: string; name: string | null; email: string };

type Props = {
  workspaceSlug: string;
  initialYear: number;
  initialMonth: number;
  initialProjects: Project[];
  initialMembers: Member[];
};

const CHANNEL_COLORS: Record<string, string> = {
  LINKEDIN: "bg-sky-100 text-sky-800 border-sky-200",
  INSTAGRAM: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  TIKTOK: "bg-teal-100 text-teal-800 border-teal-200",
  BLOG: "bg-emerald-100 text-emerald-800 border-emerald-200",
  NEWSLETTER: "bg-orange-100 text-orange-800 border-orange-200",
  YOUTUBE: "bg-red-100 text-red-800 border-red-200",
  WEBSITE: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  IDEA: "bg-gray-400",
  DRAFT: "bg-gray-400",
  REVIEW: "bg-yellow-400",
  APPROVED: "bg-blue-400",
  SCHEDULED: "bg-indigo-500",
  PUBLISHED: "bg-green-500",
  ARCHIVED: "bg-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  IDEA: "Pomysł",
  DRAFT: "Szkic",
  REVIEW: "Do recenzji",
  APPROVED: "Zatwierdzony",
  SCHEDULED: "Zaplanowany",
  PUBLISHED: "Opublikowany",
  ARCHIVED: "Zarchiwizowany",
};

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const WEEK_DAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month - 1, 1);
  const dayOfWeek = first.getDay(); // 0=Sun
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(first);
  start.setDate(first.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildMonthGrid(year: number, month: number): Date[] {
  const start = startOfMonthGrid(year, month);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  // Trim last row if it's all next month
  if (days[35] && days[35].getMonth() !== month - 1) {
    return days.slice(0, 35);
  }
  return days;
}

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function startOfWeekGrid(refDate: Date): Date[] {
  const day = refDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function CalendarClientShell({ workspaceSlug, initialYear, initialMonth, initialProjects, initialMembers }: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [weekRef, setWeekRef] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [filterProjectId, setFilterProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string>("");

  const fetchItems = useCallback(async (y: number, m: number, pId?: string) => {
    setLoading(true);
    try {
      const url = `https://content-control-tower-new.vercel.app/api/w/${workspaceSlug}/calendar/items?year=${y}&month=${m}${pId ? `&projectId=${pId}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as {
          items: CalendarItem[];
          projects: Project[];
          members: Member[];
        };
        setItems(data.items ?? []);
        if (data.projects?.length) setProjects(data.projects);
        if (data.members?.length) setMembers(data.members);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void fetchItems(year, month, filterProjectId || undefined);
  }, [year, month, filterProjectId, fetchItems]);

  function navMonth(dir: -1 | 1) {
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  function goToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setWeekRef(now);
  }

  function openNewPost(dateStr: string) {
    setSelectedDate(dateStr);
    setEditingItem(null);
    setComposerOpen(true);
  }

  function openEditPost(item: CalendarItem) {
    setEditingItem(item);
    setSelectedDate("");
    setComposerOpen(true);
  }

  function handleSaved(saved: CalendarItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function itemsForDay(key: string): CalendarItem[] {
    return items.filter((it) => it.dueAt && it.dueAt.slice(0, 10) === key);
  }

  const channelClass = (type: string | undefined) =>
    CHANNEL_COLORS[type ?? ""] ?? "bg-gray-100 text-gray-700 border-gray-200";

  const today = todayKey();
  const monthDays = buildMonthGrid(year, month);
  const weekDays = startOfWeekGrid(weekRef);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Today */}
        <button
          type="button"
          onClick={goToday}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Dzisiaj
        </button>

        {/* Month nav */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (viewMode === "month" ? navMonth(-1) : setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; }))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Poprzedni"
          >
            ‹
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
            {viewMode === "month"
              ? `${MONTH_NAMES[month - 1]} ${year}`
              : (() => {
                  const wk = startOfWeekGrid(weekRef);
                  const f = wk[0]!;
                  const l = wk[6]!;
                  if (f.getMonth() === l.getMonth()) {
                    return `${f.getDate()}–${l.getDate()} ${MONTH_NAMES[f.getMonth()]} ${f.getFullYear()}`;
                  }
                  return `${f.getDate()} ${MONTH_NAMES[f.getMonth()].slice(0, 3)} – ${l.getDate()} ${MONTH_NAMES[l.getMonth()].slice(0, 3)} ${l.getFullYear()}`;
                })()
            }
          </span>
          <button
            type="button"
            onClick={() => (viewMode === "month" ? navMonth(1) : setWeekRef((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; }))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Następny"
          >
            ›
          </button>
        </div>

        {/* View toggle */}
        <div className="flex overflow-hidden rounded-xl border border-gray-300">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-3 py-2 text-sm font-medium transition-colors ${viewMode === "month" ? "bg-[#5B7CFA] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Miesięczny
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`border-l border-gray-300 px-3 py-2 text-sm font-medium transition-colors ${viewMode === "week" ? "bg-[#5B7CFA] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Tygodniowy
          </button>
        </div>

        {/* Project filter */}
        {projects.length > 0 && (
          <select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#5B7CFA] focus:outline-none"
            aria-label="Filtruj projekt"
          >
            <option value="">Wszystkie projekty</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {loading && (
          <span className="text-xs text-gray-400 animate-pulse">Ładowanie...</span>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={() => openNewPost(today)}
          className="ml-auto flex items-center gap-2 rounded-xl bg-[#5B7CFA] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a69e8]"
        >
          <span className="text-base leading-none">+</span>
          Utwórz post
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
        <span className="text-xs font-medium text-gray-500 mr-1">Kanały:</span>
        {Object.entries(CHANNEL_COLORS).map(([type, cls]) => (
          <span key={type} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
            {type.charAt(0) + type.slice(1).toLowerCase()}
          </span>
        ))}
        <span className="ml-auto text-xs text-gray-400">Kliknij dzień → nowy post &nbsp;|&nbsp; Kliknij chip → edytuj</span>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {WEEK_DAYS.map((d) => (
              <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, idx) => {
              const key = dateKey(day);
              const isCurrentMonth = day.getMonth() === month - 1;
              const isToday = key === today;
              const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
              const dayItems = itemsForDay(key);
              const isHovered = hoveredDay === key;
              const isLast = idx >= monthDays.length - 7;

              return (
                <div
                  key={key}
                  className={`relative min-h-[110px] border-b border-r border-gray-200 p-2 transition-colors cursor-pointer
                    ${!isCurrentMonth ? "bg-gray-50" : isToday ? "bg-[#5B7CFA]/5" : isHovered ? "bg-gray-50/70" : "bg-white"}
                    ${isLast ? "border-b-0" : ""}
                    ${idx % 7 === 6 ? "border-r-0" : ""}
                  `}
                  onMouseEnter={() => setHoveredDay(key)}
                  onMouseLeave={() => setHoveredDay("")}
                  onClick={() => openNewPost(key)}
                >
                  {/* Day number */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                      ${isToday ? "bg-[#5B7CFA] text-white" : isCurrentMonth ? (isPast ? "text-gray-400" : "text-gray-700") : "text-gray-300"}
                    `}>
                      {day.getDate()}
                    </span>
                    {isHovered && isCurrentMonth && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5B7CFA] text-white text-xs font-bold leading-none">+</span>
                    )}
                  </div>

                  {/* Post chips */}
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    {dayItems.slice(0, 3).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => openEditPost(it)}
                        className={`w-full rounded-lg border px-2 py-1 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80 ${channelClass(it.channel?.type)}`}
                        title={`${it.title} — ${STATUS_LABELS[it.status] ?? it.status}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLES[it.status] ?? "bg-gray-400"}`} />
                          <span className="truncate">{it.title}</span>
                        </div>
                        {it.channel && (
                          <span className="block truncate opacity-70">{it.channel.name}</span>
                        )}
                      </button>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="pl-1 text-[10px] text-gray-400">+{dayItems.length - 3} więcej</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="grid grid-cols-7">
            {weekDays.map((day) => {
              const key = dateKey(day);
              const isToday = key === today;
              const dayItems = itemsForDay(key);

              return (
                <div
                  key={key}
                  className={`border-r border-gray-200 last:border-r-0 ${isToday ? "bg-[#5B7CFA]/5" : "bg-white"}`}
                >
                  {/* Day header */}
                  <div
                    className={`border-b border-gray-200 p-3 text-center cursor-pointer hover:bg-gray-50`}
                    onClick={() => openNewPost(key)}
                  >
                    <p className="text-xs font-medium text-gray-500 uppercase">{WEEK_DAYS[weekDays.indexOf(day)]}</p>
                    <p className={`mt-0.5 text-lg font-semibold ${isToday ? "text-[#5B7CFA]" : "text-gray-900"}`}>
                      {day.getDate()}
                    </p>
                  </div>

                  {/* Items */}
                  <div className="min-h-[300px] p-2 space-y-1.5" onClick={() => openNewPost(key)}>
                    {dayItems.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEditPost(it); }}
                        className={`w-full rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-opacity hover:opacity-80 ${channelClass(it.channel?.type)}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLES[it.status] ?? "bg-gray-400"}`} />
                          <span className="truncate font-semibold">{it.title}</span>
                        </div>
                        <div className="flex items-center justify-between opacity-70">
                          <span>{it.channel?.name ?? "—"}</span>
                          <span>{it.dueAt ? new Date(it.dueAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                      </button>
                    ))}
                    {dayItems.length === 0 && (
                      <p className="pt-4 text-center text-xs text-gray-300">+ dodaj post</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Composer modal */}
      <PostComposerModal
        workspaceSlug={workspaceSlug}
        open={composerOpen}
        initialDate={selectedDate || undefined}
        item={editingItem}
        projects={projects}
        members={members}
        onClose={() => setComposerOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
