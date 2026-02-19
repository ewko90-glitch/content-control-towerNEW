import type { ProjectProfile, PublicationJob } from "@/lib/projects/projectStore";

export type PortfolioActionPriority = "wysoki" | "sredni" | "niski";

export type PortfolioAction = {
  id: string;
  projectId?: string;
  tytul: string;
  priorytet: PortfolioActionPriority;
  dlaczegoTeraz: string;
  jesliPominiesz: string;
  ctaLabel: string;
  ctaHref: string;
  evidence: Record<string, unknown>;
};

type PortfolioActionCandidate = PortfolioAction & { score: number; sortIndex: number };

function baseScore(priority: PortfolioActionPriority): number {
  if (priority === "wysoki") {
    return 100;
  }
  if (priority === "sredni") {
    return 60;
  }
  return 20;
}

function extractTokenUsagePercent(events: any[]): number | null {
  for (const event of events) {
    const metadata = event && typeof event === "object" ? event.metadata : undefined;
    const value = metadata && typeof metadata === "object" ? metadata.tokenUsagePercent : undefined;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function buildPortfolioActions(args: {
  workspaceId: string;
  projects: ProjectProfile[];
  publicationsByProject: Record<string, PublicationJob[]>;
  membersByProject: Record<string, number>;
  telemetryEvents: any[];
}): PortfolioAction[] {
  const now = Date.now();
  const next7Boundary = now + 7 * 24 * 60 * 60 * 1000;
  const staleBoundary = now - 7 * 24 * 60 * 60 * 1000;

  const candidates: PortfolioActionCandidate[] = [];
  let sortIndex = 0;

  for (const project of args.projects) {
    const publications = args.publicationsByProject[project.id] ?? [];
    const memberCount = args.membersByProject[project.id] ?? 0;

    const upcoming7d = publications.filter((publication) => {
      const publishTs = new Date(publication.dataPublikacjiISO).getTime();
      return publishTs >= now && publishTs <= next7Boundary;
    });

    const overdue = publications.filter((publication) => {
      const publishTs = new Date(publication.dataPublikacjiISO).getTime();
      return publishTs < now && publication.status !== "opublikowane";
    });

    const unassignedUpcoming = upcoming7d.filter((publication) => !publication.assigneeId);
    const staleDrafts = publications.filter(
      (publication) => publication.status === "szkic" && new Date(publication.createdAtISO).getTime() < staleBoundary,
    );

    const hasCadence = project.cadence.czestotliwoscTygodniowa > 0;
    const hasChannels = project.kanaly.length > 0;

    const upcomingAssigned = upcoming7d.filter((publication) => Boolean(publication.assigneeId));
    const assigneeCounter = new Map<string, number>();
    for (const publication of upcomingAssigned) {
      const assigneeId = publication.assigneeId as string;
      assigneeCounter.set(assigneeId, (assigneeCounter.get(assigneeId) ?? 0) + 1);
    }

    let maxAssigneeShare = 0;
    let maxAssigneeCount = 0;
    if (upcomingAssigned.length > 0) {
      for (const count of assigneeCounter.values()) {
        const share = count / upcomingAssigned.length;
        if (share > maxAssigneeShare) {
          maxAssigneeShare = share;
          maxAssigneeCount = count;
        }
      }
    }

    if (hasCadence && upcoming7d.length === 0) {
      const priority: PortfolioActionPriority = "wysoki";
      candidates.push({
        id: `r1-${project.id}`,
        projectId: project.id,
        tytul: `Dodaj publikację na ten tydzień: ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: "Projekt ma ustawiony cadence, ale nie ma żadnej publikacji w najbliższych 7 dniach.",
        jesliPominiesz: "Cadence przestaje działać operacyjnie i rośnie ryzyko przestoju projektu.",
        ctaLabel: "Przejdź do Kalendarza",
        ctaHref: `/projects/${project.id}/kalendarz`,
        evidence: {
          rule: "R1",
          cadenceFrequency: project.cadence.czestotliwoscTygodniowa,
          upcomingCount: upcoming7d.length,
        },
        score: baseScore(priority) + 12 + project.cadence.czestotliwoscTygodniowa,
        sortIndex: sortIndex++,
      });
    }

    if (overdue.length >= 2) {
      const priority: PortfolioActionPriority = "wysoki";
      candidates.push({
        id: `r2-${project.id}`,
        projectId: project.id,
        tytul: `Urealnij backlog (zaległe): ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: `W projekcie są ${overdue.length} zaległe publikacje z terminem w przeszłości.`,
        jesliPominiesz: "Backlog będzie narastał, a zespół straci czytelny priorytet działań.",
        ctaLabel: "Przejdź do Treści",
        ctaHref: `/projects/${project.id}/tresci`,
        evidence: {
          rule: "R2",
          overdueCount: overdue.length,
        },
        score: baseScore(priority) + 10 + overdue.length * 2,
        sortIndex: sortIndex++,
      });
    }

    if (unassignedUpcoming.length >= 2) {
      const priority: PortfolioActionPriority = unassignedUpcoming.length >= 4 ? "wysoki" : "sredni";
      candidates.push({
        id: `r3-${project.id}`,
        projectId: project.id,
        tytul: `Przypisz publikacje na ten tydzień: ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: `${unassignedUpcoming.length} publikacje w 7 dni nie mają właściciela.`,
        jesliPominiesz: "Ryzyko opóźnień i braku odpowiedzialności za dowóz treści będzie rosło.",
        ctaLabel: "Przypisz publikacje",
        ctaHref: `/projects/${project.id}/tresci?filter=unassigned`,
        evidence: {
          rule: "R3",
          unassignedUpcomingCount: unassignedUpcoming.length,
          upcomingCount: upcoming7d.length,
        },
        score: baseScore(priority) + 8 + unassignedUpcoming.length,
        sortIndex: sortIndex++,
      });
    }

    if (maxAssigneeShare > 0.6) {
      const priority: PortfolioActionPriority = "sredni";
      candidates.push({
        id: `r4-${project.id}`,
        projectId: project.id,
        tytul: `Zbalansuj workload zespołu: ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: `Jedna osoba ma ${Math.round(maxAssigneeShare * 100)}% publikacji w najbliższych 7 dniach.`,
        jesliPominiesz: "Przeciążenie pojedynczej osoby zwiększy ryzyko poślizgów i obniży jakość dowozu.",
        ctaLabel: "Przejdź do Wyników",
        ctaHref: `/projects/${project.id}/wyniki`,
        evidence: {
          rule: "R4",
          maxAssigneeShare,
          maxAssigneeCount,
          upcomingAssignedCount: upcomingAssigned.length,
          teamMembersCount: memberCount,
        },
        score: baseScore(priority) + 12 + Math.round(maxAssigneeShare * 20),
        sortIndex: sortIndex++,
      });
    }

    if (staleDrafts.length >= 2) {
      const priority: PortfolioActionPriority = "sredni";
      candidates.push({
        id: `r5-${project.id}`,
        projectId: project.id,
        tytul: `Domknij lub usuń stare szkice: ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: `${staleDrafts.length} szkiców jest nieaktywnych od ponad 7 dni.`,
        jesliPominiesz: "Projekt będzie gromadził martwe szkice i utraci przejrzystość planu publikacji.",
        ctaLabel: "Przejdź do Treści",
        ctaHref: `/projects/${project.id}/tresci`,
        evidence: {
          rule: "R5",
          staleDraftsCount: staleDrafts.length,
        },
        score: baseScore(priority) + 6 + staleDrafts.length,
        sortIndex: sortIndex++,
      });
    }

    if (!hasChannels || !hasCadence) {
      const missingBoth = !hasChannels && !hasCadence;
      const priority: PortfolioActionPriority = missingBoth ? "sredni" : "niski";
      candidates.push({
        id: `r6-${project.id}`,
        projectId: project.id,
        tytul: `Uzupełnij ustawienia publikacji: ${project.nazwa}`,
        priorytet: priority,
        dlaczegoTeraz: "Projekt nie ma pełnych ustawień publikacji (kanały lub cadence).",
        jesliPominiesz: "Zespół będzie planował publikacje bez spójnych reguł wykonania.",
        ctaLabel: "Przejdź do Ustawień",
        ctaHref: `/projects/${project.id}/ustawienia`,
        evidence: {
          rule: "R6",
          hasChannels,
          hasCadence,
        },
        score: baseScore(priority) + (missingBoth ? 10 : 4),
        sortIndex: sortIndex++,
      });
    }
  }

  const tokenUsagePercent = extractTokenUsagePercent(args.telemetryEvents);
  if (tokenUsagePercent !== null && tokenUsagePercent > 80) {
    const priority: PortfolioActionPriority = "sredni";
    candidates.push({
      id: "r7-global-token-pressure",
      tytul: "Oszczędzaj tokeny: ogranicz generowanie szkiców, używaj outline",
      priorytet: priority,
      dlaczegoTeraz: `Zużycie tokenów wynosi ${tokenUsagePercent}% i przekracza próg bezpieczeństwa 80%.`,
      jesliPominiesz: "Ryzykujesz szybkie wyczerpanie tokenów i zatrzymanie części działań AI.",
      ctaLabel: "Przejdź do Token Center",
      ctaHref: "/projects#tokeny",
      evidence: {
        rule: "R7",
        tokenUsagePercent,
      },
      score: baseScore(priority) + 20 + Math.round(tokenUsagePercent - 80),
      sortIndex: sortIndex++,
    });
  }

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.id !== right.id) {
        return left.id.localeCompare(right.id);
      }
      return left.sortIndex - right.sortIndex;
    })
    .slice(0, 7)
    .map(({ score: _score, sortIndex: _sortIndex, ...action }) => action);
}
