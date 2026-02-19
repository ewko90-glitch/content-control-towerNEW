"use server";

import { prisma } from "@/lib/prisma";
import { estimateCredits, ensureWorkspaceCredits, spendCredits } from "@/modules/ai/credits";
import { getDefaultProvider } from "@/modules/ai/provider";
import type { AIAssistAction } from "@/modules/content/types";
import { getContentItem } from "@/server/queries/content";

export type RunAIAssistResult = {
  ok: boolean;
  errorCode?: "OUT_OF_CREDITS" | "VALIDATION" | "INTERNAL";
  estimatedCost: number;
  remainingAfter?: number;
  suggestion?: { body: string; meta?: Record<string, unknown>; tokensUsed: number; model: string };
};

function isAIAssistAction(value: string): value is AIAssistAction {
  return value === "improve" || value === "seo_optimize" || value === "adapt_channel";
}

export async function runAIAssist(
  workspaceId: string,
  contentId: string,
  action: AIAssistAction,
): Promise<RunAIAssistResult> {
  if (!isAIAssistAction(action)) {
    return {
      ok: false,
      errorCode: "VALIDATION",
      estimatedCost: 0,
    };
  }

  try {
    const content = await getContentItem(contentId, workspaceId);
    if (!content || content.versions.length === 0 || !content.project.context) {
      return {
        ok: false,
        errorCode: "VALIDATION",
        estimatedCost: 0,
      };
    }

    const currentBody = content.versions[0]?.body ?? "";
    const estimatedCost = estimateCredits(action, content.channel, currentBody.length);

    const credits = await ensureWorkspaceCredits(workspaceId);
    const remaining = Math.max(0, credits.monthlyLimit - credits.usedThisMonth);

    if (remaining < estimatedCost) {
      return {
        ok: false,
        errorCode: "OUT_OF_CREDITS",
        estimatedCost,
        remainingAfter: remaining,
      };
    }

    const provider = getDefaultProvider();
    const suggestion = await provider.generate({
      action,
      channel: content.channel,
      projectContext: {
        name: content.project.name,
        summary: String(content.project.context.summary ?? ""),
        audience: String(content.project.context.audience ?? ""),
        toneOfVoice: String(content.project.context.toneOfVoice ?? ""),
        goals: String(content.project.context.goals ?? ""),
        channels: Array.isArray(content.project.context.channels)
          ? content.project.context.channels
              .map((value) => String(value).toLowerCase())
              .filter((value): value is "linkedin" | "blog" | "newsletter" | "landing" =>
                value === "linkedin" || value === "blog" || value === "newsletter" || value === "landing",
              )
          : [],
        keywordsPrimary: Array.isArray(content.project.context.keywordsPrimary)
          ? content.project.context.keywordsPrimary.map((value) => String(value))
          : [],
        keywordsSecondary: Array.isArray(content.project.context.keywordsSecondary)
          ? content.project.context.keywordsSecondary.map((value) => String(value))
          : [],
        internalLinks: Array.isArray(content.project.context.internalLinks)
          ? content.project.context.internalLinks.map((entry) => {
              const value = entry as Record<string, unknown>;
              return {
                url: String(value.url ?? ""),
                title: String(value.title ?? ""),
                note: typeof value.note === "string" ? value.note : undefined,
                anchorHints: Array.isArray(value.anchorHints) ? value.anchorHints.map((hint) => String(hint)) : [],
              };
            })
          : [],
        externalLinks: Array.isArray(content.project.context.externalLinks)
          ? content.project.context.externalLinks.map((entry) => {
              const value = entry as Record<string, unknown>;
              return {
                url: String(value.url ?? ""),
                title: String(value.title ?? ""),
                note: typeof value.note === "string" ? value.note : undefined,
              };
            })
          : [],
      },
      planItem: {
        id: content.planItemId ?? undefined,
        clusterId: content.clusterId,
        clusterLabel: content.clusterLabel,
        primaryKeyword: content.primaryKeyword,
        secondaryKeywords: content.secondaryKeywords,
        internalLinkSuggestions: content.internalLinkSuggestions,
        externalLinkSuggestions: content.externalLinkSuggestions,
      },
      currentBody,
      title: content.title,
      goal: content.goal,
      angle: content.angle,
    });

    const spend = await spendCredits(workspaceId, estimatedCost);
    if (!spend.ok) {
      return {
        ok: false,
        errorCode: "OUT_OF_CREDITS",
        estimatedCost,
        remainingAfter: spend.remaining,
      };
    }

    await prisma.$transaction(async (tx) => {
      const model = tx as unknown as {
        aiUsageEvent: {
          create: (args: unknown) => Promise<Record<string, unknown>>;
        };
        contentBuilderItem: {
          update: (args: unknown) => Promise<Record<string, unknown>>;
        };
      };

      await model.aiUsageEvent.create({
        data: {
          workspaceId,
          contentId,
          action,
          creditsUsed: estimatedCost,
          tokensUsed: suggestion.tokensUsed,
          model: suggestion.model,
          meta: {
            channel: content.channel,
            projectId: content.projectId,
            planItemId: content.planItemId,
            success: true,
          },
        },
      });

      await model.contentBuilderItem.update({
        where: { id: content.id },
        data: {
          aiGenerationUsed: true,
          aiTokensUsed: {
            increment: suggestion.tokensUsed,
          },
        },
      });
    });

    return {
      ok: true,
      estimatedCost,
      remainingAfter: spend.remaining,
      suggestion: {
        body: suggestion.suggestedBody,
        meta: suggestion.suggestedMeta,
        tokensUsed: suggestion.tokensUsed,
        model: suggestion.model,
      },
    };
  } catch {
    return {
      ok: false,
      errorCode: "INTERNAL",
      estimatedCost: 0,
    };
  }
}
