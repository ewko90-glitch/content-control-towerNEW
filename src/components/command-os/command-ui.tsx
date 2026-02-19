"use client";

import { commandCopy } from "./command-copy";
import type { RankedCommand } from "./command-types";

type CommandPaletteUiProps = {
  open: boolean;
  query: string;
  activeIndex: number;
  results: RankedCommand[];
  onClose: () => void;
  onChangeQuery: (query: string) => void;
  onSelectIndex: (index: number) => void;
  onExecuteIndex: (index: number) => void;
};

function renderTitleWithMatch(title: string, ranges: Array<{ start: number; end: number }>) {
  if (ranges.length === 0) {
    return <>{title}</>;
  }

  const [range] = ranges;
  const left = title.slice(0, range.start);
  const match = title.slice(range.start, range.end);
  const right = title.slice(range.end);

  return (
    <>
      {left}
      <span className="text-foreground">{match}</span>
      {right}
    </>
  );
}

export function CommandPaletteUi(props: CommandPaletteUiProps) {
  return (
    <div
      className={`fixed inset-0 z-[120] transition-opacity duration-150 ${props.open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px]" onClick={props.onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command OS"
        className={`absolute left-1/2 top-20 w-[min(92vw,780px)] -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl transition-all duration-150 ${props.open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <div className="border-b border-border px-4 py-3">
          <input
            value={props.query}
            onChange={(event) => props.onChangeQuery(event.currentTarget.value)}
            placeholder={commandCopy.placeholder}
            className="w-full bg-transparent text-sm text-card-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="max-h-[62vh] overflow-y-auto py-2" role="listbox" aria-label="Lista komend">
          {props.results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{commandCopy.empty}</div>
          ) : (
            props.results.map((entry, index) => (
              <button
                key={entry.command.id}
                type="button"
                role="option"
                onMouseEnter={() => props.onSelectIndex(index)}
                onClick={() => props.onExecuteIndex(index)}
                className={`flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors ${props.activeIndex === index ? "bg-muted/70" : "hover:bg-muted/40"}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-card-foreground">
                    {renderTitleWithMatch(entry.command.title, entry.matchedTitleRanges)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{entry.command.description}</span>
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {commandCopy.groups[entry.command.group]}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
