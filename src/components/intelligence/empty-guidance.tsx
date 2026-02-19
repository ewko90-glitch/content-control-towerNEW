import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

import { intelligenceCopy } from "./intelligence-copy";

type EmptyGuidanceMode = "no-content" | "no-publication-plan" | "no-signals";

type EmptyGuidanceProps = {
  mode: EmptyGuidanceMode;
  workspaceSlug: string;
};

export function EmptyGuidance(props: EmptyGuidanceProps) {
  const copy =
    props.mode === "no-content"
      ? intelligenceCopy.empty.noContent
      : props.mode === "no-publication-plan"
        ? intelligenceCopy.empty.noPublicationPlan
        : intelligenceCopy.empty.noSignals;

  const ctaHref = props.mode === "no-publication-plan" ? `#content-board` : `/w/${props.workspaceSlug}/content#new-content`;

  return (
    <Card className="rounded-2xl border border-border bg-surface shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-textMuted">{copy.subtitle}</p>
        <Link href={ctaHref}>
          <Button size="sm">{copy.cta}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
