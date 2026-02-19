# Setup

## Prerequisites

- Node.js 18+ (Node.js 20 LTS recommended)
- npm 9+
- PostgreSQL 14+ running locally (or reachable remote instance)

## Environment Variables

Use `.env.local` for local development.

Required variable:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/content_control_tower?schema=public"
```

`DATABASE_URL` is also documented in `.env.example` as a placeholder template.

## Prisma Commands

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create your first migration later (after adding models to `prisma/schema.prisma`):

```bash
npm run prisma:migrate -- --name init
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

Format Prisma schema:

```bash
npm run prisma:format
```

## Health Check Endpoint

An unauthenticated DB health route is available at:

`/api/health/db`

It executes a trivial DB query (`SELECT 1`) using Prisma.

Test it after starting your Next.js app:

```bash
curl http://localhost:3000/api/health/db
```

Expected success response:

```json
{ "ok": true }
```
