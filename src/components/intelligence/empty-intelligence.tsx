import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

import { intelligenceCopy } from "./intelligence-copy";

type EmptyIntelligenceMode = "workspace" | "signals" | "metrics";

type EmptyIntelligenceProps = {
  mode: EmptyIntelligenceMode;
  workspaceSlug: string;
};

export function EmptyIntelligence(props: EmptyIntelligenceProps) {
  const copy = intelligenceCopy.empty[props.mode];

  return (
    <Card className="rounded-2xl border border-border bg-surface shadow-soft">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-textMuted">{copy.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/w/${props.workspaceSlug}/content#new-content`}>
            <Button size="sm">{copy.ctaPrimary}</Button>
          </Link>
          {props.mode === "workspace" ? (
            <Link href={`/w/${props.workspaceSlug}/content#content-board`}>
              <Button size="sm" variant="ghost">
                {intelligenceCopy.empty.workspace.ctaSecondary}
              </Button>
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
