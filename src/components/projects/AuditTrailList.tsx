"use client";

import { useMemo, useState } from "react";

import { AuditEventBadge } from "@/components/projects/AuditEventBadge";
import type { AuditEvent } from "@/lib/projects/projectStore";

type AuditTrailListProps = {
  events: AuditEvent[];
  emptyMessage?: string;
  initialLimit?: number;
  showExpandLink?: boolean;
};

function formatTimestampShort(value: string): string {
  const date = new Date(value);
  return date.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditTrailList({
  events,
  emptyMessage = "Brak zdarzeń audit.",
  initialLimit,
  showExpandLink = false,
}: AuditTrailListProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleEvents = useMemo(() => {
    if (!initialLimit || expanded) {
      return events;
    }
    return events.slice(0, initialLimit);
  }, [events, initialLimit, expanded]);

  if (events.length === 0) {
    return <p className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-sm text-[#64748B]">{emptyMessage}</p>;
  }

  return (
    <section className="space-y-2">
      {visibleEvents.map((event) => (
        <article key={event.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <AuditEventBadge type={event.type} />
              <p className="text-sm font-medium text-[#0F172A]">{event.summary}</p>
              <p className="text-xs text-[#64748B]">
                {formatTimestampShort(event.timestampISO)} • {event.actor.name} ({event.actor.role})
              </p>
            </div>
          </div>

          <details className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2">
            <summary className="cursor-pointer text-xs font-medium text-[#334155]">Pokaż szczegóły</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-[#475569]">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </details>
        </article>
      ))}

      {showExpandLink && initialLimit && events.length > initialLimit && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-medium text-[#5B7CFA] hover:underline"
        >
          Zobacz wszystko
        </button>
      ) : null}
    </section>
  );
}
