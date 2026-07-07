# __projectName__

A TypeScript fullstack monorepo scaffolded with pnpm workspaces and Turborepo.

## Prerequisites

- Node.js 22.12+
- pnpm 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- Docker (for local Postgres and Redis)

## Getting started

```bash
pnpm install                                          # installs deps + generates Prisma client
pnpm setup:env                                        # creates .env files from .env.example
docker compose up -d                                  # starts Postgres and Redis
pnpm --filter @__scope__/db migrate:dev --name init       # creates initial DB migration
pnpm dev                                              # starts api and web
```

The API runs on `http://localhost:3001` and the web app on `http://localhost:5173`.

## Project structure

- `apps/web` — React frontend (Vite), uses `@__scope__/api-client` for typed API calls
- `apps/api` — Hono API on Bun, with CORS, request logging, error handling, Zod env and request validation
- `apps/worker` — Background worker on Bun, ready to extend with a queue consumer
- `packages/config` — Shared TypeScript configs (base, react, node, bun)
- `packages/db` — Prisma schema and singleton client
- `packages/shared-types` — Cross-boundary Zod schemas and inferred TS types
- `packages/api-client` — Typed Hono RPC client used by the frontend

## Local services

`docker-compose.yml` runs Postgres and Redis for local dev.

```bash
docker compose up -d   # start
docker compose down    # stop
docker compose logs -f # follow logs
```

## Scripts

- `pnpm dev` — start all dev servers
- `pnpm build` — build all packages
- `pnpm typecheck` — TypeScript across all packages
- `pnpm lint` — Biome lint and format check
- `pnpm lint:fix` — Biome auto-fix
- `pnpm format` — Biome format
- `pnpm test` — run Vitest tests across all packages
- `pnpm db:generate` — regenerate Prisma client
- `pnpm setup:env` — copy every `.env.example` to `.env` (skips files that exist)
- `pnpm --filter @__scope__/db migrate:dev --name <name>` — create and apply a Prisma migration
- `pnpm --filter @__scope__/db studio` — open Prisma Studio

## Environment variables

Each app validates its own env on startup using Zod. If a required variable is missing or wrong shape, the app fails fast with a clear error.

- `apps/api/src/env.ts` — `NODE_ENV`, `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `LOG_LEVEL`
- `apps/web/src/env.ts` — `VITE_API_URL` (build-time, must be prefixed with `VITE_`)
- `apps/worker/src/env.ts` — `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`

Run `pnpm setup:env` after install to create `.env` files from each `.env.example`.

## Type-safe API calls

The API exports its route shape as `AppType`, which `@__scope__/api-client` consumes via Hono RPC. This means the frontend gets full autocomplete and type-checking for every API endpoint, request body, and response shape, with no codegen step.

```ts
import { createApiClient } from '@__scope__/api-client';
const api = createApiClient(env.VITE_API_URL);
const res = await api.echo.$post({ json: { message: 'hi' } });
const data = await res.json(); // typed
```

When you add a new route to the API, the frontend client picks it up automatically through TypeScript inference.
