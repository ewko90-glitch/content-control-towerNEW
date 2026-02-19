import { spawnSync } from "node:child_process";

import bcrypt from "bcryptjs";

const EMPLOYEE_EMAIL = "employee@local.test";
const COO_EMAIL = "coo@local.test";
const DEFAULT_PASSWORD = "LocalDemo123!";
const WORKSPACE_SLUG = "local-demo-workspace";

function currentWeekDates(): { monday: string; wednesday: string; friday: string } {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const wednesday = new Date(monday);
  wednesday.setDate(monday.getDate() + 2);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const toSqlDate = (value: Date): string => value.toISOString().slice(0, 10);
  return {
    monday: toSqlDate(monday),
    wednesday: toSqlDate(wednesday),
    friday: toSqlDate(friday),
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed is disabled in production.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run seed.");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const escapedHash = passwordHash.replaceAll("'", "''");
  const weekDates = currentWeekDates();

  const sql = `
INSERT INTO "User" ("id", "email", "name", "passwordHash", "emailVerifiedAt", "createdAt", "updatedAt")
VALUES
  ('dev_employee_user', '${EMPLOYEE_EMAIL}', 'Local Employee', '${escapedHash}', NOW(), NOW(), NOW()),
  ('dev_coo_user', '${COO_EMAIL}', 'Local COO', '${escapedHash}', NOW(), NOW(), NOW())
ON CONFLICT ("email")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "emailVerifiedAt" = NOW(),
  "updatedAt" = NOW();

INSERT INTO "Workspace" ("id", "name", "slug", "ownerId", "createdAt", "updatedAt")
VALUES ('dev_workspace_local_demo', 'Local Demo Workspace', '${WORKSPACE_SLUG}', 'dev_coo_user', NOW(), NOW())
ON CONFLICT ("slug")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "ownerId" = EXCLUDED."ownerId",
  "deletedAt" = NULL,
  "updatedAt" = NOW();

INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role", "createdAt", "updatedAt")
VALUES
  ('dev_membership_employee', 'dev_workspace_local_demo', 'dev_employee_user', 'EDITOR', NOW(), NOW()),
  ('dev_membership_coo', 'dev_workspace_local_demo', 'dev_coo_user', 'MANAGER', NOW(), NOW())
ON CONFLICT ("workspaceId", "userId")
DO UPDATE SET
  "role" = EXCLUDED."role",
  "updatedAt" = NOW();

INSERT INTO "Project" ("id", "workspaceId", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  ('dev_project_local_demo', 'dev_workspace_local_demo', 'Local Demo Project', 'local-demo-project', 'Sample project for local execution health checks.', NOW(), NOW())
ON CONFLICT ("workspaceId", "slug")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "deletedAt" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ProjectContext" (
  "id", "projectId", "summary", "audience", "toneOfVoice", "goals", "channels",
  "keywordsPrimary", "keywordsSecondary", "internalLinks", "externalLinks", "readinessScore", "readinessState", "missingFields", "updatedAt"
)
VALUES (
  'dev_project_context_local_demo',
  'dev_project_local_demo',
  'Local demo context for validating content operations and execution health.',
  'B2B marketing and operations leaders',
  'clear, premium, pragmatic',
  'Increase publication consistency and execution visibility',
  '["blog","linkedin","newsletter"]'::jsonb,
  '["execution health","content operations"]'::jsonb,
  '["plan drift","delivery risk","weekly cadence"]'::jsonb,
  '[{"url":"https://local.demo/internal/execution-health","title":"Execution Health Framework"}]'::jsonb,
  '[{"url":"https://nextjs.org/docs","title":"Next.js Docs"}]'::jsonb,
  100,
  'ready',
  '[]'::jsonb,
  NOW()
)
ON CONFLICT ("projectId")
DO UPDATE SET
  "summary" = EXCLUDED."summary",
  "audience" = EXCLUDED."audience",
  "toneOfVoice" = EXCLUDED."toneOfVoice",
  "goals" = EXCLUDED."goals",
  "channels" = EXCLUDED."channels",
  "keywordsPrimary" = EXCLUDED."keywordsPrimary",
  "keywordsSecondary" = EXCLUDED."keywordsSecondary",
  "internalLinks" = EXCLUDED."internalLinks",
  "externalLinks" = EXCLUDED."externalLinks",
  "readinessScore" = EXCLUDED."readinessScore",
  "readinessState" = EXCLUDED."readinessState",
  "missingFields" = EXCLUDED."missingFields",
  "updatedAt" = NOW();

INSERT INTO "PublicationPlan" (
  "id", "workspaceId", "projectId", "name", "status", "startDate", "cadence", "channels", "createdAt", "updatedAt"
)
VALUES (
  'dev_plan_local_demo_weekly',
  'dev_workspace_local_demo',
  'dev_project_local_demo',
  'Local Demo Weekly Plan',
  'active',
  NOW(),
  '{"freq":"weekly","daysOfWeek":[1,3,5]}'::jsonb,
  '["blog","linkedin","newsletter"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("id")
DO UPDATE SET
  "workspaceId" = EXCLUDED."workspaceId",
  "projectId" = EXCLUDED."projectId",
  "name" = EXCLUDED."name",
  "status" = EXCLUDED."status",
  "startDate" = EXCLUDED."startDate",
  "cadence" = EXCLUDED."cadence",
  "channels" = EXCLUDED."channels",
  "updatedAt" = NOW();

INSERT INTO "PublicationPlanItem" (
  "id", "planId", "publishDate", "title", "channel", "status", "primaryKeyword", "secondaryKeywords",
  "internalLinkSuggestions", "externalLinkSuggestions", "clusterId", "clusterLabel", "note", "createdAt", "updatedAt"
)
VALUES
  (
    'dev_plan_item_local_monday',
    'dev_plan_local_demo_weekly',
    DATE '${weekDates.monday}',
    'Execution Health baseline update',
    'blog',
    'planned',
    'execution health baseline',
    '["delivery risk","plan adherence"]'::jsonb,
    '[{"url":"/w/local-demo-workspace/portfolio/execution-health","title":"Execution Health"}]'::jsonb,
    '[{"url":"https://nextjs.org/docs","title":"Next.js Docs"}]'::jsonb,
    'cluster-execution-health',
    'Execution Health',
    'Weekly baseline article',
    NOW(),
    NOW()
  ),
  (
    'dev_plan_item_local_wednesday',
    'dev_plan_local_demo_weekly',
    DATE '${weekDates.wednesday}',
    'Content autopilot operations brief',
    'linkedin',
    'queued',
    'content autopilot operations',
    '["content queue","autopilot"]'::jsonb,
    '[{"url":"/w/local-demo-workspace/content","title":"Autopilot"}]'::jsonb,
    '[{"url":"https://www.postgresql.org/docs","title":"PostgreSQL Docs"}]'::jsonb,
    'cluster-content-ops',
    'Content Ops',
    'Mid-week operations update',
    NOW(),
    NOW()
  ),
  (
    'dev_plan_item_local_friday',
    'dev_plan_local_demo_weekly',
    DATE '${weekDates.friday}',
    'COO weekly delivery wrap-up',
    'newsletter',
    'planned',
    'weekly delivery wrap-up',
    '["coo report","portfolio risk"]'::jsonb,
    '[{"url":"/w/local-demo-workspace/calendar","title":"Calendar"}]'::jsonb,
    '[{"url":"https://nextjs.org/blog","title":"Next.js Blog"}]'::jsonb,
    'cluster-coo-delivery',
    'COO Delivery',
    'End-of-week summary',
    NOW(),
    NOW()
  )
ON CONFLICT ("id")
DO UPDATE SET
  "planId" = EXCLUDED."planId",
  "publishDate" = EXCLUDED."publishDate",
  "title" = EXCLUDED."title",
  "channel" = EXCLUDED."channel",
  "status" = EXCLUDED."status",
  "primaryKeyword" = EXCLUDED."primaryKeyword",
  "secondaryKeywords" = EXCLUDED."secondaryKeywords",
  "internalLinkSuggestions" = EXCLUDED."internalLinkSuggestions",
  "externalLinkSuggestions" = EXCLUDED."externalLinkSuggestions",
  "clusterId" = EXCLUDED."clusterId",
  "clusterLabel" = EXCLUDED."clusterLabel",
  "note" = EXCLUDED."note",
  "updatedAt" = NOW();
`;

  const result = spawnSync("prisma", ["db", "execute", "--schema", "prisma/schema.prisma", "--stdin"], {
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf-8",
    env: process.env,
    shell: true,
  });

  if (result.status !== 0) {
    const details = [result.error?.message, result.stderr, result.stdout].filter((value) => Boolean(value)).join("\n");
    throw new Error(details || `Seed execution failed with exit code ${String(result.status)}.`);
  }

  console.log("Local seed complete:");
  console.log(`- Workspace: ${WORKSPACE_SLUG}`);
  console.log(`- Employee: ${EMPLOYEE_EMAIL} / ${DEFAULT_PASSWORD}`);
  console.log(`- COO: ${COO_EMAIL} / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
