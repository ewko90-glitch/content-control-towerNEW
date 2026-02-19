import { describe, expect, it } from "vitest";
import { archiveStrategicArtifact, getStrategicArtifacts, saveStrategicArtifact, seedDefaultStrategyIfEmpty } from "../store";

describe("strategy store", () => {
  it("seeds defaults when empty", async () => {
    const workspaceId = `w-seed-${Date.now().toString(36)}`;
    const seeded = await seedDefaultStrategyIfEmpty(workspaceId);

    expect(seeded.length).toBe(3);
    expect(seeded.some((item) => item.title === "Ship consistent weekly content cadence")).toBe(true);
  });

  it("keeps active limit and archives deterministically", async () => {
    const workspaceId = `w-limit-${Date.now().toString(36)}`;
    await seedDefaultStrategyIfEmpty(workspaceId);

    for (let index = 0; index < 110; index += 1) {
      await saveStrategicArtifact(workspaceId, {
        type: index % 2 === 0 ? "decision" : "priority",
        title: `Artifact ${index}`,
        description: "desc",
        intent: "intent",
        horizon: "this_quarter",
      });
    }

    const artifacts = await getStrategicArtifacts(workspaceId);
    const artifactsAgain = await getStrategicArtifacts(workspaceId);
    const active = artifacts.filter((item) => item.status === "active");
    const archived = artifacts.filter((item) => item.status === "archived");

    expect(active.length).toBeLessThanOrEqual(100);
    expect(archived.length).toBeGreaterThan(0);
    expect(archived.length).toBeLessThanOrEqual(300);
    expect(artifactsAgain.map((item) => item.id)).toStrictEqual(artifacts.map((item) => item.id));
  });

  it("archives and keeps artifact in store", async () => {
    const workspaceId = `w-archive-${Date.now().toString(36)}`;
    const saved = await saveStrategicArtifact(workspaceId, {
      type: "priority",
      title: "Archive me",
      description: "desc",
      intent: "intent",
      horizon: "this_quarter",
    });

    const archived = await archiveStrategicArtifact(workspaceId, saved.id);
    const list = await getStrategicArtifacts(workspaceId);

    expect(archived).toBe(true);
    expect(list.find((item) => item.id === saved.id)?.status).toBe("archived");
  });
});
