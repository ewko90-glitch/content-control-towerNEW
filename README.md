# content-control-towerNEW

## Local bootstrap

1. Copy environment file:

```bash
cp .env.example .env
```

1. Install dependencies:

```bash
npm install
```

1. Set `DATABASE_URL` in `.env` to your local PostgreSQL database.

1. Reset database, apply migrations, and seed local demo data:

```bash
npm run local:reset
```

1. Start development server:

```bash
npm run dev
```

1. Login with seeded accounts:

- Employee: `employee@local.test` / `LocalDemo123!`
- COO: `coo@local.test` / `LocalDemo123!`

## Temporary local test accounts (development)

- Employee: `employee@local.test` / `LocalDemo123!`
- COO: `coo@local.test` / `LocalDemo123!`

These accounts are created by `prisma/seed.ts` and both are members of workspace `local-demo-workspace`.
Seed also creates a ready demo project context and a weekly publication plan so UI views are not empty.

## Role policy in local UX

- Employee (mapped from workspace role `EDITOR`/`VIEWER`):
  - Primary navigation: Content, Calendar, Projects
  - Blocked from `/w/:workspaceSlug/portfolio/*` and redirected to Content
- COO (mapped from workspace role `MANAGER`/`ADMIN`):
  - Primary navigation: Portfolio, Execution Health, Executive
  - Also has access to Content and Calendar

## Dev-only switch user

On `/account`, in development mode only, use `Dev Switch User` buttons to switch between Employee and COO quickly.
