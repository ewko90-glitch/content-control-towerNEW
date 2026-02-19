export type CommandGroup =
  | "recent"
  | "navigate"
  | "create"
  | "decision-lab"
  | "workflow"
  | "risk-analysis"
  | "help";

export type CommandContext = {
  pathname: string;
  workspaceSlug?: string;
  isContentPage: boolean;
  highRisk: boolean;
  bottleneckStage?: string;
  hasSignals: boolean;
  hasDecisionLab: boolean;
  hasDecisionEntries: boolean;
  hasCurrentStrategy: boolean;
  latestDecisionId?: string;
};

export type CommandAction =
  | {
      kind: "navigate";
      href: string;
    }
  | {
      kind: "noop";
    };

export type CommandDefinition = {
  id: string;
  title: string;
  description: string;
  group: CommandGroup;
  keywords: string[];
  shortcut?: string;
  groupPriority: number;
  when?: (context: CommandContext) => boolean;
  contextBoost?: (context: CommandContext) => number;
  action: (context: CommandContext) => CommandAction;
};

export type RankedCommand = {
  command: CommandDefinition;
  score: number;
  matchedTitleRanges: Array<{ start: number; end: number }>;
};
