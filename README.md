# create-monorepo

A single shell script that scaffolds an opinionated, production-ready TypeScript fullstack monorepo with end-to-end type safety, in one command.

```bash
bash create-monorepo.sh my-app --install
cd my-app
docker compose up -d
pnpm --filter @my-app/db migrate:dev --name init
pnpm dev
```

That's it. You get a working API at `http://localhost:3001` and a React app at `http://localhost:5173` that calls it through a fully typed client — no codegen step.

## What you get

- **`apps/web`** — React 18 + Vite, with a Zod-validated env and a typed API client.
- **`apps/api`** — Hono on Bun, with CORS, request logging, error handling, and Zod-validated env + request bodies.
- **`apps/worker`** — Bun background worker, ready for a queue consumer (BullMQ, scheduled tasks, etc.).
- **`packages/api-client`** — Typed Hono RPC client. The frontend imports it and gets full autocomplete for every API route, request body, and response shape.
- **`packages/db`** — Prisma schema + singleton client, shared across api and worker.
- **`packages/shared-types`** — Zod schemas with inferred TS types, shared across boundaries.
- **`packages/config`** — Shared TypeScript configs (base, react, node, bun).

Plus: pnpm workspaces, Turborepo task graph (with Prisma generate as a build dep), Biome for lint+format, Vitest for tests, Docker Compose for local Postgres + Redis, GitHub Actions CI, Dependabot, EditorConfig, `.nvmrc`, `.npmrc`, and a clean initial git commit on `main`.

## The pitch: end-to-end type safety with no codegen

`apps/api` exports its route shape as `AppType`. `packages/api-client` consumes it via Hono RPC. `apps/web` calls the API through that client.

```ts
import { createApiClient } from '@my-app/api-client';
const api = createApiClient(env.VITE_API_URL);
const res = await api.echo.$post({ json: { message: 'hi' } });
const data = await res.json(); // fully typed, inferred from the API
```

Add a route to the API and the frontend picks it up automatically through TypeScript inference. No OpenAPI, no codegen, no drift.

## Usage

```bash
bash create-monorepo.sh <project-name> [scope] [--install]
```

| Argument | Required | Description |
| --- | --- | --- |
| `project-name` | yes | Lowercase letters, digits, and hyphens only. Becomes the directory name. |
| `scope` | no | Package scope, e.g. `@myorg`. Defaults to `@<project-name>`. |
| `--install` | no | Runs `pnpm install` and `pnpm setup:env` after scaffolding. |
| `-h`, `--help` | no | Prints usage. |

### Examples

```bash
# Minimal: project name only, scope defaults to @my-app
bash create-monorepo.sh my-app

# Custom org scope (recommended if you publish under an org)
bash create-monorepo.sh my-app @acme

# Scaffold + install dependencies in one shot
bash create-monorepo.sh my-app @acme --install
```

## Prerequisites

**Required** (script fails without these):

- **git** — [git-scm.com/downloads](https://git-scm.com/downloads)
- **pnpm 9+** — `corepack enable && corepack prepare pnpm@latest --activate`

**Required to run the scaffolded apps** (script warns but continues):

- **Bun 1.1+** — `curl -fsSL https://bun.sh/install | bash` (used by `apps/api` and `apps/worker`)
- **Docker** — for local Postgres + Redis via `docker compose up -d`
- **Node 20+** — pinned in `.nvmrc`; pnpm enforces it via `engine-strict`

## After scaffolding

Without `--install`:

```bash
cd <project-name>
pnpm install                                          # installs deps + generates Prisma client
pnpm setup:env                                        # creates .env files from .env.example
docker compose up -d                                  # starts Postgres + Redis
pnpm --filter @<scope>/db migrate:dev --name init     # creates initial DB migration
pnpm dev                                              # starts api and web
```

With `--install`, the first two steps are done for you.

Then verify:

```bash
curl http://localhost:3001/health
open http://localhost:5173
```

## What the scaffolded repo looks like

```
my-app/
├── apps/
│   ├── api/              Hono on Bun, with Zod env + request validation
│   ├── web/              React + Vite, calls the API through a typed client
│   └── worker/           Bun background worker
├── packages/
│   ├── api-client/       Typed Hono RPC client (consumed by web)
│   ├── config/           Shared TS configs (base/react/node/bun)
│   ├── db/               Prisma schema + singleton client
│   └── shared-types/     Zod schemas + inferred TS types
├── scripts/
│   └── setup-env.mjs     Copies every .env.example to .env
├── .github/
│   ├── dependabot.yml    Weekly npm + GitHub Actions updates
│   └── workflows/ci.yml  Lint, typecheck, test on push + PR
├── docker-compose.yml    Postgres 16 + Redis 7
├── biome.json            Lint + format config
├── turbo.json            Task graph with Prisma generate as a build dep
├── tsconfig.json
├── pnpm-workspace.yaml
└── package.json
```

## Common scripts in the scaffolded repo

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start all dev servers (api on 3001, web on 5173) |
| `pnpm build` | Build every package |
| `pnpm typecheck` | Run `tsc --noEmit` across the workspace via Turbo |
| `pnpm lint` / `pnpm lint:fix` | Biome check / auto-fix |
| `pnpm format` | Biome format |
| `pnpm test` | Run Vitest across all packages |
| `pnpm db:generate` | Regenerate the Prisma client (also runs on `pnpm install`) |
| `pnpm setup:env` | Copy every `.env.example` to `.env`, skipping files that exist |
| `pnpm --filter @<scope>/db migrate:dev --name <name>` | Create and apply a Prisma migration |
| `pnpm --filter @<scope>/db studio` | Open Prisma Studio |

## Environment variables

Each app validates its own env on startup with Zod and fails fast on a clear error if anything is missing or wrong shape:

- `apps/api/src/env.ts` — `NODE_ENV`, `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `LOG_LEVEL`
- `apps/web/src/env.ts` — `VITE_API_URL` (build-time, must be `VITE_`-prefixed)
- `apps/worker/src/env.ts` — `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`

Run `pnpm setup:env` to create `.env` files from each `.env.example`.

## Design choices worth knowing

- **Prisma client generates on `pnpm install`** via a `postinstall` in `packages/db`. You don't have to remember `pnpm db:generate` after a fresh clone.
- **Turbo treats `db:generate` as a build dependency**, so any task that needs Prisma's types runs it first if needed.
- **`apps/api` exports `./routes`**, separate from server bootstrap. This lets the api-client import `AppType` without pulling in Bun/Node-only code.
- **The initial git commit uses your `git config`** (user.name + user.email) if set, falling back to a placeholder identity only on machines without git configured.
- **Biome instead of ESLint + Prettier** — single tool, fast, sane defaults.
- **Vitest workspace config at the root** so a plain `vitest` runs every package's tests.

## Customizing the template

This is one shell script. To adapt it:

1. Edit `create-monorepo.sh` directly — every file the script writes is in a heredoc you can find by name.
2. Re-run `bash create-monorepo.sh test-scaffold` against `/tmp` to verify your change works end-to-end.
3. Run `pnpm typecheck`, `pnpm lint`, and `pnpm test` in the generated repo to confirm nothing is broken.

Common things people change: pinned dependency versions, `apps/api` route patterns, the Prisma starter schema, the Docker Compose services, the CI workflow.

## License

MIT. Use it, fork it, ship things.
