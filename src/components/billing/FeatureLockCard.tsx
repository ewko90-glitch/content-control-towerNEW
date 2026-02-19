import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { AccessResult } from "@/lib/billing/featureAccess";

type FeatureLockCardProps = {
  tytulFunkcji: string;
  access: Extract<AccessResult, { status: "zablokowane_planem" | "brak_tokenow" }>;
};

export function FeatureLockCard({ tytulFunkcji, access }: FeatureLockCardProps) {
  return (
    <Card className="mb-4 rounded-2xl border border-border bg-surface2/60 shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle>{tytulFunkcji}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-sm text-muted">{access.powod}</p>

        <div className="flex flex-wrap items-center gap-2">
          {access.status === "zablokowane_planem" ? (
            <Link
              href="/pricing#plans"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              Ulepsz plan
            </Link>
          ) : null}

          {access.status === "brak_tokenow" ? (
            <Link
              href="/pricing#plans"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs text-text"
            >
              Dokup tokeny
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
