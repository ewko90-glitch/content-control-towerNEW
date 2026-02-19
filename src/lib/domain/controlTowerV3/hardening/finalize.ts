import type { ControlTowerDecisionSnapshot } from "../snapshot";
import { normalizeDecisionSnapshot } from "./normalize";
import { sanitizeSnapshot } from "./sanitize";

export function finalizeDecisionSnapshot(snapshot: ControlTowerDecisionSnapshot): ControlTowerDecisionSnapshot {
  const sanitized = sanitizeSnapshot({ snapshot });
  const withSanitizeWarnings: ControlTowerDecisionSnapshot = {
    ...sanitized.snapshot,
    warnings: [...(sanitized.snapshot.warnings ?? []), ...sanitized.warnings],
  };

  const withSchemaWarning: ControlTowerDecisionSnapshot =
    withSanitizeWarnings.schemaVersion && withSanitizeWarnings.schemaVersion.length > 0
      ? withSanitizeWarnings
      : {
          ...withSanitizeWarnings,
          warnings: [
            ...(withSanitizeWarnings.warnings ?? []),
            {
              code: "MISSING_SCHEMA_VERSION",
              message: "Snapshot schema version is missing.",
              severity: "high",
            },
          ],
        };

  return normalizeDecisionSnapshot(withSchemaWarning);
}
