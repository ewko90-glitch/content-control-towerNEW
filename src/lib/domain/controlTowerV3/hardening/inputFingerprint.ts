import type { InputFingerprint, InputSummary } from "../types";

function safeNumber(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function buildInputFingerprint(params: {
  inputSummary: InputSummary;
  overduePublicationsCount?: number;
  stuckContentCount?: number;
  approvalsPendingCount?: number;
  upcomingNext7DaysCount?: number;
}): InputFingerprint {
  const c = safeNumber(params.inputSummary.contentCount);
  const p = safeNumber(params.inputSummary.publicationJobsCount);
  const a = safeNumber(params.inputSummary.approvalsCount);
  const od = safeNumber(params.overduePublicationsCount);
  const st = safeNumber(params.stuckContentCount);
  const ap = safeNumber(params.approvalsPendingCount);
  const up = safeNumber(params.upcomingNext7DaysCount);

  const canonical = `c=${c}|p=${p}|a=${a}|od=${od}|st=${st}|ap=${ap}|up=${up}`;
  const value = fnv1a32(canonical).toString(36);

  return {
    value,
    canonical,
    components: ["c", "p", "a", "od", "st", "ap", "up"],
  };
}
