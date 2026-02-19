const MAX_RECENT = 8;

function keyForWorkspace(workspaceSlug?: string): string {
  return `cct:command:recent:${workspaceSlug ?? "global"}`;
}

export function readRecentCommands(workspaceSlug?: string): string[] {
  try {
    const raw = window.localStorage.getItem(keyForWorkspace(workspaceSlug));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentCommand(workspaceSlug: string | undefined, commandId: string): string[] {
  const current = readRecentCommands(workspaceSlug);
  const deduped = [commandId, ...current.filter((entry) => entry !== commandId)].slice(0, MAX_RECENT);

  try {
    window.localStorage.setItem(keyForWorkspace(workspaceSlug), JSON.stringify(deduped));
  } catch {
    return deduped;
  }

  return deduped;
}
