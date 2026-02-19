export type Role = "ADMIN" | "MANAGER" | "EDITOR" | "VIEWER";
export type WorkflowStatus = "IDEA" | "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type PublicationStatus = "PLANNED" | "READY" | "PUBLISHED" | "FAILED" | "CANCELED";
export type Severity = "info" | "warning" | "danger";

export type Impact = {
  score: number;
  label: "Niski" | "Średni" | "Wysoki" | "Krytyczny";
};

export type Confidence = {
  score: number;
  label: "Niska" | "Średnia" | "Wysoka";
};

export type SignalPermissions = {
  canExecute: boolean;
  reasonIfDisabled?: string;
};

export type Signal = {
  key: string;
  severity: Severity;
  title: string;
  description: string;
  why: string;
  metricChip?: string;
  impact: Impact;
  confidence: Confidence;
  cta: { label: string; href: string };
  permissions: SignalPermissions;
};

export type TimelineItem = {
  id: string;
  time: string;
  title: string;
  channelLabel: string;
  status: PublicationStatus;
  href: string;
};

export type TimelineGroup = {
  key: "today" | "tomorrow" | "week";
  title: "Dziś" | "Jutro" | "Ten tydzień";
  items: TimelineItem[];
  emptyCta?: { label: string; href: string };
};

export type HealthBreakdown = {
  key: string;
  title: string;
  points: number;
  maxPoints: number;
  explanation: string;
  severity: Severity;
  relatedHref: string;
};

export type HealthScore = {
  score: number;
  label: "Świetna forma" | "Stabilnie" | "Wymaga uwagi" | "Krytyczne";
  breakdown: HealthBreakdown[];
};

export type DashboardMetrics = {
  totalContent: number;
  overdueCount: number;
  overdueMaxAgeDays: number;
  reviewCount: number;
  reviewOver48hCount: number;
  avgReviewHours: number;
  upcomingToday: number;
  upcomingTomorrow: number;
  upcomingWeek: number;
  noneUpcomingWeek: boolean;
  creditsRemaining: number;
  monthlyCredits: number;
  creditsUsedPct: number;
  aiJobs7d: number;
  contentCreated7d: number;
  workflowEvents7d: number;
  byStatus: Record<WorkflowStatus, number>;
};

export type DashboardRaw = {
  workspace: {
    id: string;
    slug: string;
    name: string;
    role: Role;
  };
  publicationRows: Array<{
    id: string;
    scheduledAt: Date;
    status: PublicationStatus;
    contentItemId: string;
    contentTitle: string;
    channelLabel: string;
  }>;
  counts: {
    total: number;
    idea: number;
    draft: number;
    review: number;
    approved: number;
    scheduled: number;
    published: number;
    archived: number;
    overdue: number;
    overdueMaxAgeDays: number;
  };
  review: {
    count: number;
    over48h: number;
    avgHours: number;
  };
  activity: {
    content7d: number;
    aiJobs7d: number;
    workflow7d: number;
  };
  credits: {
    remaining: number;
    monthly: number;
    usedPct: number;
  };
};

export type DashboardSnapshot = {
  generatedAt: string;
  workspace: DashboardRaw["workspace"];
  subtitle: string;
  metrics: DashboardMetrics;
  health: HealthScore;
  priority: Signal;
  actionCards: Signal[];
  timeline: TimelineGroup[];
  insights: Array<{ key: string; text: string; severity: Severity }>;
  quickActions: Array<{ key: string; label: string; href: string; disabled?: boolean; reason?: string }>;
  emptyState?: {
    title: string;
    steps: [string, string, string];
    cta: { label: string; href: string };
  };
};
