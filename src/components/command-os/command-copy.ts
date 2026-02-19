import type { CommandGroup } from "./command-types";

export const commandCopy = {
  placeholder: "Wpisz komendę lub przejdź do…",
  keyboardHint: "⌘K",
  empty: "Brak komend dla tego zapytania.",
  groups: {
    recent: "Ostatnie",
    navigate: "Nawigacja",
    create: "Tworzenie",
    "decision-lab": "Decision Lab",
    workflow: "Workflow",
    "risk-analysis": "Ryzyko i analiza",
    help: "Pomoc",
  } satisfies Record<CommandGroup, string>,
} as const;
