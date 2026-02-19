import { describe, expect, it } from "vitest";

import { DEFAULT_WORKFLOW_POLICY } from "../../policy";
import { executeTransition } from "../executor";
import { getRecentTransitionEvents } from "../auditStore";
import { sanitizeMetadata, sanitizeReason } from "../validation";
import type { WorkflowEntityRef, WorkflowTransitionRequest } from "../types";
import { InMemoryWorkflowAdapter } from "./fixtures";

function makeRef(suffix: string): WorkflowEntityRef {
  return {
    workspaceId: `ws-${suffix}`,
    entityType: "content",
    entityId: `content-${suffix}`,
  };
}

function makeRequest(ref: WorkflowEntityRef): WorkflowTransitionRequest {
  return {
    ref,
    actor: {
      userId: "user-1",
      role: "editor",
    },
    policy: DEFAULT_WORKFLOW_POLICY,
    targetStageId: "review",
  };
}

describe("workflow runtime executor contract", () => {
  it("allows valid transition and appends audit", async () => {
    const adapter = new InMemoryWorkflowAdapter();
    const ref = makeRef("valid");
    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const result = await executeTransition({
      req: makeRequest(ref),
      adapter,
      now: new Date("2026-02-01T10:15:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(adapter.getCurrentState(ref)?.stageId).toBe("review");
    expect(adapter.getWriteCount(ref)).toBe(1);

    const events = await getRecentTransitionEvents({
      workspaceId: ref.workspaceId,
      entityId: ref.entityId,
      limit: 10,
    });
    expect(events.length).toBe(1);
    expect(events[0]?.fromStageId).toBe("draft");
    expect(events[0]?.toStageId).toBe("review");
  });

  it("denies forbidden role transition", async () => {
    const adapter = new InMemoryWorkflowAdapter();
    const ref = makeRef("forbidden");
    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const req = makeRequest(ref);
    req.actor.role = "viewer";

    const result = await executeTransition({
      req,
      adapter,
      now: new Date("2026-02-01T10:15:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ROLE_NOT_ALLOWED");
    }
    expect(adapter.getWriteCount(ref)).toBe(0);
  });

  it("returns invalid transition for disallowed path", async () => {
    const adapter = new InMemoryWorkflowAdapter();
    const ref = makeRef("invalid-transition");
    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const req = makeRequest(ref);
    req.targetStageId = "published";

    const result = await executeTransition({
      req,
      adapter,
      now: new Date("2026-02-01T10:15:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TRANSITION");
    }
    expect(adapter.getWriteCount(ref)).toBe(0);
  });

  it("returns conflict on optimistic concurrency mismatch", async () => {
    const adapter = new InMemoryWorkflowAdapter();
    const ref = makeRef("conflict");
    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const req = makeRequest(ref);
    req.expected = { updatedAt: "2026-02-01T09:59:59.000Z" };

    const result = await executeTransition({
      req,
      adapter,
      now: new Date("2026-02-01T10:15:00.000Z"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CONFLICT");
    }
    expect(adapter.getWriteCount(ref)).toBe(0);
  });

  it("returns idempotent replay on second request with same key", async () => {
    const adapter = new InMemoryWorkflowAdapter();
    const ref = makeRef("idempotency");
    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const req = makeRequest(ref);
    req.idempotencyKey = "manual-idem-key";

    const first = await executeTransition({
      req,
      adapter,
      now: new Date("2026-02-01T10:15:00.000Z"),
    });
    expect(first.ok).toBe(true);

    adapter.seed(ref, { stageId: "draft", updatedAt: "2026-02-01T10:00:00.000Z" });

    const second = await executeTransition({
      req,
      adapter,
      now: new Date("2026-02-01T10:15:30.000Z"),
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("IDEMPOTENT_REPLAY");
    }
    expect(adapter.getWriteCount(ref)).toBe(1);
  });

  it("sanitizes reason by stripping newlines and capping length", () => {
    const input = `line 1\nline 2\n${"x".repeat(200)}`;
    const output = sanitizeReason(input);

    expect(output).toBeDefined();
    expect(output?.includes("\n")).toBe(false);
    expect((output ?? "").length).toBeLessThanOrEqual(140);
  });

  it("sanitizes metadata by dropping nested values and capping entries", () => {
    const metadata: Record<string, unknown> = {
      a_simple: "ok",
      a_number: 1,
      a_flag: true,
      nested: { value: "no" },
      list: [1, 2, 3],
      longValue: "y".repeat(121),
    };

    for (let index = 0; index < 30; index += 1) {
      metadata[`k${index}`] = index;
    }

    const output = sanitizeMetadata(metadata);
    expect(output).toBeDefined();
  expect(output?.a_simple).toBe("ok");
  expect(output?.a_number).toBe(1);
  expect(output?.a_flag).toBe(true);
    expect(output?.nested).toBeUndefined();
    expect(output?.list).toBeUndefined();
    expect(output?.longValue).toBeUndefined();
    expect(Object.keys(output ?? {}).length).toBeLessThanOrEqual(20);
  });
});
