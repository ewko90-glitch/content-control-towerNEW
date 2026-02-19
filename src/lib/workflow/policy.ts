import type { WorkflowPolicy } from "./types";
import { WORKFLOW_POLICY_VERSION } from "./versioning";

export const DEFAULT_WORKFLOW_POLICY: WorkflowPolicy = {
  version: WORKFLOW_POLICY_VERSION,
  stages: [
    { id: "draft", label: "Draft", order: 1 },
    { id: "review", label: "Review", order: 2, requiresApproval: true },
    { id: "approved", label: "Approved", order: 3 },
    { id: "scheduled", label: "Scheduled", order: 4 },
    { id: "published", label: "Published", order: 5, terminal: true },
  ],
  transitions: [
    { from: "draft", to: "review" },
    { from: "review", to: "approved" },
    { from: "review", to: "draft", reversible: true },
    { from: "approved", to: "scheduled" },
    { from: "approved", to: "review", reversible: true },
    { from: "scheduled", to: "published" },
  ],
  guards: [
    { from: "draft", to: "review", allowedRoles: ["editor", "owner"] },
    { from: "review", to: "approved", allowedRoles: ["manager", "owner"] },
    { from: "review", to: "draft", allowedRoles: ["owner"] },
    { from: "approved", to: "scheduled", allowedRoles: ["owner"] },
    { from: "approved", to: "review", allowedRoles: ["owner"] },
    { from: "scheduled", to: "published", allowedRoles: ["owner"] },
  ],
};
