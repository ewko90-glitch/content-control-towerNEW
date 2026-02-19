import { contextBoostForCommand } from "./command-intelligence";
import type { CommandContext, CommandDefinition, RankedCommand } from "./command-types";

function tokenize(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function titleMatchScore(query: string, title: string): { score: number; ranges: Array<{ start: number; end: number }> } {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  if (!normalizedQuery) {
    return { score: 0, ranges: [] };
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return { score: 120, ranges: [{ start: 0, end: normalizedQuery.length }] };
  }

  const start = normalizedTitle.indexOf(normalizedQuery);
  if (start >= 0) {
    return { score: 70, ranges: [{ start, end: start + normalizedQuery.length }] };
  }

  return { score: 0, ranges: [] };
}

function tokenScore(tokens: string[], command: CommandDefinition): number {
  if (tokens.length === 0) {
    return 0;
  }

  const titleTokens = command.title.toLowerCase().split(/\s+/);
  const keywordTokens = command.keywords.map((entry) => entry.toLowerCase());

  let score = 0;
  for (const token of tokens) {
    if (titleTokens.some((titleToken) => titleToken.startsWith(token))) {
      score += 40;
      continue;
    }
    if (titleTokens.some((titleToken) => titleToken.includes(token))) {
      score += 24;
      continue;
    }
    if (keywordTokens.some((keyword) => keyword.includes(token))) {
      score += 14;
    }
  }

  return score;
}

export function scoreCommand(
  query: string,
  command: CommandDefinition,
  context: CommandContext,
  recentCommandIds: string[],
): RankedCommand {
  const normalizedQuery = query.trim().toLowerCase();
  const tokens = tokenize(normalizedQuery);
  const titleScore = titleMatchScore(normalizedQuery, command.title);
  const tokensScore = tokenScore(tokens, command);
  const contextScore = contextBoostForCommand(command, context);
  const recentIndex = recentCommandIds.indexOf(command.id);
  const recentScore = recentIndex >= 0 ? Math.max(0, 24 - recentIndex * 3) : 0;

  return {
    command,
    score: titleScore.score + tokensScore + contextScore + recentScore,
    matchedTitleRanges: titleScore.ranges,
  };
}

export function searchCommands(params: {
  query: string;
  commands: CommandDefinition[];
  context: CommandContext;
  recentCommandIds: string[];
}): RankedCommand[] {
  const normalizedQuery = params.query.trim().toLowerCase();

  const ranked = params.commands
    .filter((command) => (command.when ? command.when(params.context) : true))
    .map((command) => scoreCommand(normalizedQuery, command, params.context, params.recentCommandIds));

  const filtered = normalizedQuery.length > 0 ? ranked.filter((entry) => entry.score > 0) : ranked;

  return filtered.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.command.groupPriority !== left.command.groupPriority) {
      return right.command.groupPriority - left.command.groupPriority;
    }
    const byTitle = left.command.title.localeCompare(right.command.title);
    if (byTitle !== 0) {
      return byTitle;
    }
    return left.command.id.localeCompare(right.command.id);
  });
}
