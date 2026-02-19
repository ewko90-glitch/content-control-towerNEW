import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

import { intelligenceCopy } from "./intelligence-copy";
import type { GuidedState } from "./intelligence-engine";

type NextBestActionProps = {
  state: GuidedState;
  fallbackHref: string;
  dataHref: string;
};

export function NextBestAction(props: NextBestActionProps) {
  const actionTitle = props.state.primaryAction?.title ?? intelligenceCopy.nextAction.fallbackTitle;
  const actionHref = props.state.primaryAction?.cta?.href ?? props.fallbackHref;
  const actionLabel = props.state.primaryAction?.cta?.label ?? intelligenceCopy.nextAction.primaryFallback;

  return (
    <Card id="intelligence-why" className="rounded-2xl border border-border bg-surface shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">{intelligenceCopy.nextAction.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-text">{actionTitle}</p>
        <div className="rounded-xl border border-border bg-surface2 px-3 py-2">
          <p className="text-sm font-medium text-text">{intelligenceCopy.nextAction.why}</p>
          <ul className="mt-1 space-y-1 text-sm text-textMuted">
            {props.state.explanationBullets.slice(0, 3).map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        </div>

        {!props.state.primaryAction ? <p className="text-sm text-textMuted">{intelligenceCopy.nextAction.fallbackDescription}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Link href={actionHref}>
            <Button size="sm">{actionLabel}</Button>
          </Link>
          <Link href={props.dataHref}>
            <Button size="sm" variant="ghost">
              {intelligenceCopy.nextAction.secondary}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
