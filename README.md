# create-honorepo

`create-honorepo` is a Bun-authored, Node-compatible CLI for scaffolding a full-stack TypeScript monorepo in one command.

It creates a ready-to-run workspace with a Hono API, a background worker, a React frontend, Prisma, Postgres, Redis, shared Zod schemas, a typed Hono RPC client, pnpm workspaces, Turborepo, Biome, Vitest, Docker Compose, and CI defaults. The goal is to start with end-to-end type safety and practical project structure already wired together, without a codegen step.

## Quick Start

```bash
npm create honorepo my-app
cd my-app
pnpm setup:env
docker compose up -d
pnpm --filter @my-app/db migrate:dev --name init
pnpm dev
```

You get a working API at `http://localhost:3001` and a web app at `http://localhost:5173` that calls it through a fully typed client.

## Generated Stack

- **`apps/web`** — React 19 frontend (Vite) with a Zod-validated env and a typed API client.
- **`apps/api`** — Hono on Bun, with CORS, request logging, error handling, and Zod-validated env + request bodies.
- **`apps/worker`** — Bun background worker, ready for a queue consumer (BullMQ, scheduled tasks, etc.).
- **`packages/api-client`** — Typed Hono RPC client. The frontend imports it and gets full autocomplete for every API route, request body, and response shape.
- **`packages/db`** — Prisma 7 schema, `prisma.config.ts`, and a singleton client (via `@prisma/adapter-pg`), shared across api and worker.
- **`packages/shared-types`** — Zod schemas with inferred TS types, shared across boundaries.
- **`packages/config`** — Shared TypeScript configs (base, react, node, bun).

Plus: pnpm workspaces, Turborepo task graph (with Prisma generate as a build dep), Biome for lint+format, Vitest for tests, Docker Compose for local Postgres + Redis, GitHub Actions CI, Dependabot, EditorConfig, `.nvmrc`, `.npmrc`, and a clean initial git commit on `main`.

## Why it exists

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
npm create honorepo <project-name> [options]
```

Equivalent invocations:

```bash
npm  create honorepo my-app
pnpm create honorepo my-app
yarn create honorepo my-app
bun  create honorepo my-app
```

The CLI prompts interactively for the package scope, whether to initialize a git repository, and whether to install dependencies. Pass flags to skip prompts, or `-y/--yes` to accept all defaults.

### Options

| Flag | Description |
| --- | --- |
| `<project-name>` | Lowercase letters, digits, and hyphens. Becomes the directory name and root package name. Pass `.` to scaffold into the current empty directory, named after it. |
| `--scope <name>` | Package scope (e.g. `acme` → `@acme/web`). Defaults to the project name. |
| `--no-scope` | Unscoped package names, prefixed with the project name (`my-app-web`, `my-app-db`, …). |
| `--install` / `--no-install` | Install dependencies after scaffolding. Defaults to yes if `pnpm` is on `PATH`. |
| `--git` / `--no-git` | Initialize a git repository. Defaults to yes if `git` is on `PATH`. |
| `-y`, `--yes` | Accept all defaults; non-interactive. |
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show CLI version. |

Unknown or malformed flags are rejected with an error (so a typo like `--no-instal` can't silently install).

### Examples

```bash
# Interactive: prompts for scope, git, install
npm create honorepo my-app

# Pass-through scope flag (note the `--` separator with `npm create`)
npm create honorepo my-app -- --scope acme

# Fully non-interactive, skip install
npm create honorepo my-app -- -y --no-install

# Scaffold into the current (empty) directory, named after it
mkdir my-app && cd my-app
npm create honorepo .

# pnpm and bun do not need the `--`
pnpm create honorepo my-app --scope acme
bun  create honorepo my-app --scope acme
```

> **`npm create` flag-passing.** With `npm create`, npm consumes flags before the bin script does. To pass options through, separate them with `--`. `pnpm create`, `yarn create`, and `bun create` do not have this restriction.

## Requirements

- **Node 22+** (to run the CLI; the scaffolded project requires 22.12+)
- **pnpm 10+** in the scaffolded project — the project pins its exact pnpm via the `packageManager` field, so any modern pnpm will self-switch to it
- **Bun 1.1+** to run the scaffolded `apps/api` and `apps/worker` (`curl -fsSL https://bun.sh/install | bash`)
- **Docker** for local Postgres + Redis via `docker compose up -d`

The CLI itself only needs Node. The scaffolded apps need pnpm + Bun + Docker.

## After scaffolding

If you skipped install:

```bash
cd <project-name>
pnpm install                                          # installs deps + generates Prisma client
pnpm setup:env                                        # creates .env files from .env.example
docker compose up -d                                  # starts Postgres + Redis
pnpm --filter @<scope>/db migrate:dev --name init     # creates initial DB migration
pnpm dev                                              # starts api and web
```

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
│   ├── web/              React frontend, calls the API through a typed client
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
├── docker-compose.yml    Postgres 18 + Redis 8
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

For unscoped projects (`--no-scope`), the db package is named `<project>-db`, so the filter becomes `pnpm --filter <project>-db …`. The scaffolder's "Next steps" output always prints the right form.

## Environment variables

Each app validates its own env on startup with Zod and fails fast with a clear error if anything is missing or wrong shape:

- `apps/api/src/env.ts` — `NODE_ENV`, `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `LOG_LEVEL`
- `apps/web/src/env.ts` — `VITE_API_URL` (build-time, must be `VITE_`-prefixed)
- `apps/worker/src/env.ts` — `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`

Run `pnpm setup:env` to create `.env` files from each `.env.example`.

## Design choices worth knowing

- **Prisma client generates on `pnpm install`** via a `postinstall` in `packages/db`. You don't have to remember `pnpm db:generate` after a fresh clone.
- **Turbo treats `db:generate` as a build dependency**, so any task that needs Prisma's types runs it first if needed.
- **`apps/api` exports `./routes`**, separate from server bootstrap. This lets the api-client import `AppType` without pulling in Bun/Node-only code.
- **The initial git commit uses your `git config`** (user.name + user.email) if set, falling back to a placeholder identity only on machines without git configured.
- **Install runs before the initial commit**, so `pnpm-lock.yaml` lands in it and the generated CI's `pnpm install --frozen-lockfile` passes on the very first push.
- **Prisma 7 with the driver-adapter client** — `prisma.config.ts` in `packages/db` holds the CLI config, and the client connects through `@prisma/adapter-pg`.
- **Biome instead of ESLint + Prettier** — single tool, fast, sane defaults.
- **Tests run per-package via `turbo run test`** (`pnpm test` at the root fans out to every package with a test script).

## How the scaffolder works

```
create-honorepo/
├── bin/index.ts          CLI entry — argv parsing, help/version, dispatch
├── src/
│   ├── cli.ts            Orchestrator: prompts → validate → scaffold → postinstall
│   ├── prompts.ts        Interactive prompts (`prompts` lib) + `--`-eating detection
│   ├── validate.ts       Name/scope rules, target-dir empty check
│   ├── scaffold.ts       Template walker, dotfile rename, variable substitution
│   └── postinstall.ts    git init (with fallback identity) + pnpm install with spinner
├── template/             Real files — the scaffolded monorepo source of truth
├── tests/                Unit tests + a snapshot test against a hash fixture
└── dist/index.js         What npm publishes (Bun-built, Node-compatible, ESM)
```

Authoring is in TypeScript with Bun (`bun install`, `bun test`, `bun run dev`). The published artifact is plain JS produced by `bun build --target=node`, so end users only need Node 22+ to run `npm create honorepo`.

## Customizing the template

Every file the CLI emits lives under `template/` as a real, editable file — no heredocs.

1. Clone this repo and edit files under `template/` directly. Dotfiles are stored as `_gitignore`, `_npmrc`, `_env.example`, etc., and renamed at scaffold time (npm strips dotfiles when packing tarballs).
2. Variable substitution uses `__projectName__` and `__scope__` placeholders. Package references must use the `@__scope__/name` form — with `--no-scope` the whole prefix is rewritten to `<projectName>-name`. Add a placeholder where you need it; the scaffolder will substitute on copy. (Mustache `{{...}}` was avoided to prevent collisions with JSX inline-style syntax.)
3. Test your change: `bun test tests/` runs the snapshot test that catches accidental drift, and `bun run dev test-app --yes --no-install` scaffolds a fresh `./test-app/` directory you can inspect.
4. Inside the scaffolded output, run `pnpm install`, `pnpm typecheck`, and `pnpm test` to confirm nothing is broken end-to-end.

Common things people change: pinned dependency versions, `apps/api` route patterns, the Prisma starter schema, the Docker Compose services, the CI workflow.

## Development

```bash
bun install
bun run dev my-test-app --yes --no-install   # runs the CLI in dev (TS direct, no build)
bun run typecheck                             # tsc --noEmit
bun test tests/                               # unit + snapshot tests
bun run build                                 # produces dist/index.js for publish
```

When you change template files intentionally, regenerate the fixture so the snapshot test passes again:

```bash
UPDATE_SNAPSHOTS=1 bun test tests/
```

The CI workflow (`.github/workflows/ci.yml`) runs four jobs: the Bun toolchain (typecheck, tests, build), a smoke matrix (Ubuntu Node 22/24 + Windows) that scaffolds **with a real install** and runs typecheck/lint/test/build in the result, a scenarios job covering `--no-scope`, `--scope`, `.`-directory, and error paths, and an end-to-end job that boots Postgres/Redis in Docker, migrates, and curls the running API.

## Releasing

Releases are published by `.github/workflows/release.yml`: bump `version` in `package.json`, tag the commit `v<version>`, and push the tag. The workflow re-runs checks, verifies the tag matches the package version and that the tarball contains the template files, then runs `npm publish --provenance`. It needs an `NPM_TOKEN` repository secret (an npm automation token).

## License

MIT. Use it, fork it, ship things.
