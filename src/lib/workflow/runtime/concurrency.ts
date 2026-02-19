import type { WorkflowEntityState } from "./types";

export function checkExpectedState(params: {
  current: WorkflowEntityState;
  expected?: { updatedAt?: string; revision?: string };
}): { ok: true } | { ok: false; message: string } {
  const { current, expected } = params;

  if (!expected) {
    return { ok: true };
  }

  if (typeof expected.updatedAt === "string" && expected.updatedAt !== current.updatedAt) {
    return { ok: false, message: "updatedAt mismatch" };
  }

  if (typeof expected.revision === "string" && expected.revision !== current.revision) {
    return { ok: false, message: "revision mismatch" };
  }

  return { ok: true };
}
