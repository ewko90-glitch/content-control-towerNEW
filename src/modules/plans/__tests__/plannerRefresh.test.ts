import { describe, expect, it } from "vitest";

import { generateRefreshedPlanProposal, type RefreshPlannerInput } from "@/modules/plans/planner";

function baseInput(overrides: Partial<RefreshPlannerInput> = {}): RefreshPlannerInput {
  return {
    sourcePlanId: "plan-source-1",
    proposalName: "Propozycja odświeżenia — Test",
    horizonWeeks: 8,
    startDateISO: "2026-02-16T00:00:00.000Z",
    cadence: {
      freq: "weekly",
      daysOfWeek: [1],
    },
    channels: ["blog", "linkedin", "newsletter"],
    clusters: [
      {
        clusterId: "cluster-a",
        clusterLabel: "A",
        primaryKeyword: "strategia treści",
        secondaryKeywords: ["plan treści"],
        performanceState: "high",
        coverageState: "healthy",
        weight: 2.0,
        rationale: "Mocny klaster.",
      },
      {
        clusterId: "cluster-b",
        clusterLabel: "B",
        primaryKeyword: "audyt treści",
        secondaryKeywords: ["analiza contentu"],
        performanceState: "medium",
        coverageState: "thin",
        weight: 1.2,
        rationale: "Klaster do wzmocnienia.",
      },
      {
        clusterId: "cluster-c",
        clusterLabel: "C",
        primaryKeyword: "kalendarz publikacji",
        secondaryKeywords: ["harmonogram"],
        performanceState: "unknown",
        coverageState: "missing",
        weight: 0.8,
        rationale: "Klaster z luką.",
      },
    ],
    internalLinks: [
      { url: "https://example.com/wew-1", title: "Wew 1", anchorHints: ["A"] },
      { url: "https://example.com/wew-2", title: "Wew 2", anchorHints: ["B"] },
      { url: "https://example.com/wew-3", title: "Wew 3", anchorHints: ["C"] },
    ],
    externalLinks: [
      { url: "https://external.com/src-1", title: "Źródło 1" },
      { url: "https://external.com/src-2", title: "Źródło 2" },
    ],
    ...overrides,
  };
}

describe("generateRefreshedPlanProposal", () => {
  it("zwraca identyczny wynik dla tych samych danych wejściowych", () => {
    const input = baseInput();

    const first = generateRefreshedPlanProposal(input);
    const second = generateRefreshedPlanProposal(input);

    expect(first).toEqual(second);
  });

  it("zapewnia obecność klastrów missing/thin co najmniej raz", () => {
    const input = baseInput({
      horizonWeeks: 4,
      channels: ["blog"],
      cadence: { freq: "weekly", daysOfWeek: [1] },
      clusters: [
        {
          clusterId: "high",
          clusterLabel: "Wysoki",
          primaryKeyword: "skalowanie treści",
          secondaryKeywords: [],
          performanceState: "high",
          coverageState: "healthy",
          weight: 3,
          rationale: "Mocny klaster.",
        },
        {
          clusterId: "missing",
          clusterLabel: "Brakujący",
          primaryKeyword: "braki treści",
          secondaryKeywords: [],
          performanceState: "unknown",
          coverageState: "missing",
          weight: 0.2,
          rationale: "Brak pokrycia.",
        },
      ],
    });

    const result = generateRefreshedPlanProposal(input);
    const hasMissing = result.proposal.items.some((item) => item.clusterId === "missing");

    expect(hasMissing).toBe(true);
  });

  it("nie powiela primaryKeyword w oknie 14 dni, gdy dostępne są różne klastry", () => {
    const input = baseInput({
      horizonWeeks: 8,
      channels: ["blog"],
      cadence: { freq: "weekly", daysOfWeek: [1] },
    });

    const result = generateRefreshedPlanProposal(input);
    const byKeyword = new Map<string, Date[]>();

    for (const item of result.proposal.items) {
      const list = byKeyword.get(item.primaryKeyword) ?? [];
      list.push(new Date(item.publishDate));
      byKeyword.set(item.primaryKeyword, list);
    }

    for (const dates of byKeyword.values()) {
      const sorted = dates.sort((left, right) => left.getTime() - right.getTime());
      for (let index = 1; index < sorted.length; index += 1) {
        const diffMs = sorted[index]!.getTime() - sorted[index - 1]!.getTime();
        const diffDays = diffMs / (24 * 60 * 60 * 1000);
        expect(diffDays).toBeGreaterThan(14);
      }
    }
  });

  it("tworzy newsletter tygodniowy przy wybranym kanale newsletter", () => {
    const input = baseInput({
      horizonWeeks: 4,
      channels: ["blog", "newsletter"],
      cadence: { freq: "weekly", daysOfWeek: [1, 3] },
    });

    const result = generateRefreshedPlanProposal(input);
    const newsletters = result.proposal.items.filter((item) => item.channel === "newsletter");

    expect(newsletters.length).toBeGreaterThanOrEqual(4);
    expect(newsletters.every((item) => item.note.includes("Newsletter tygodniowy"))).toBe(true);
  });

  it("klamruje wagi klastrów do zakresu 0.2-3.0", () => {
    const input = baseInput({
      clusters: [
        {
          clusterId: "low",
          clusterLabel: "Low",
          primaryKeyword: "low kw",
          secondaryKeywords: [],
          performanceState: "low",
          coverageState: "healthy",
          weight: 0,
          rationale: "low",
        },
        {
          clusterId: "high",
          clusterLabel: "High",
          primaryKeyword: "high kw",
          secondaryKeywords: [],
          performanceState: "high",
          coverageState: "healthy",
          weight: 99,
          rationale: "high",
        },
      ],
      channels: ["blog"],
      cadence: { freq: "weekly", daysOfWeek: [1] },
      horizonWeeks: 2,
    });

    const result = generateRefreshedPlanProposal(input);

    for (const cluster of result.diagnostics.clusterStats) {
      expect(cluster.weight).toBeGreaterThanOrEqual(0.2);
      expect(cluster.weight).toBeLessThanOrEqual(3.0);
    }
  });
});
