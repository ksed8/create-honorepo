# Changelog

## 2.0.0

### Breaking changes

- **Node 22+ everywhere.** The CLI requires Node 22+, and scaffolded projects require
  Node 22.12+ (`engines` + `.nvmrc` + `engine-strict=true`). Node 18/20 are EOL.
- **pnpm 10+.** Scaffolded projects pin `pnpm@11.x` via `packageManager` (modern pnpm
  self-switches to the pinned version). Build scripts are approved via `allowBuilds`
  in `pnpm-workspace.yaml`.
- **Template stack modernized:** React 19, Vite 8, Zod 4, Prisma 7, Vitest 4, Biome 2,
  Turbo 2.10, Postgres 18, Redis 8.
- **Prisma 7 layout.** The client is generated into `packages/db/src/generated/`
  (gitignored) with the `prisma-client` generator, CLI config lives in
  `packages/db/prisma.config.ts`, and the runtime client connects through
  `@prisma/adapter-pg`.
- **Unknown or malformed CLI flags now error** instead of being silently ignored.
- `template/vitest.workspace.ts` removed; tests run per-package via `turbo run test`.

### Fixed

- `--no-scope` (and an empty scope in the interactive prompt) generated invalid package
  names like `@/web`. Unscoped projects now get project-name-prefixed packages
  (`my-app-web`, `my-app-db`, …) across names, workspace dependencies, and imports.
- `pnpm install` now runs **before** `git init`, so `pnpm-lock.yaml` is included in the
  initial commit and the generated CI's `pnpm install --frozen-lockfile` passes on the
  first push. The generated CI also tolerates a missing lockfile.
- pnpm detection and installation now work on Windows (`pnpm.cmd` needs a shell).
- `--yes` no longer defaults to installing when pnpm is not on `PATH`, and a failed
  install prints recovery steps and exits 0 (the project files are intact).
- The "pass flags after `--`" tip works with npm 7+ (the old `npm_config_argv`
  detection had been dead for years).
- `pnpm setup:env` now also creates the root `.env` (turbo's `globalDependencies`
  references it).
- Comments and docs in the template used literal `@scope/...` that escaped placeholder
  substitution; they now use real tokens.
- The scaffold snapshot fixture no longer silently regenerates when missing.
- Removed dead code: unreachable reserved-name validation, unused turbo `lint`/`clean`
  tasks.

### Added

- `npm create honorepo .` scaffolds into the current directory (must be empty; a
  pre-existing `.git` or `.DS_Store` doesn't count, and an existing repo is never
  committed into).
- Real route tests in the template API (`app.request()` against `/health` and `/echo`)
  instead of placeholder assertions.
- Release automation: pushing a `v*` tag runs checks and publishes to npm with
  provenance (`.github/workflows/release.yml`, requires the `NPM_TOKEN` secret).
- CI now covers Windows, a scenarios job (`--no-scope`, `--scope`, `.`, error paths),
  and a Docker end-to-end job that migrates the database and curls the running API.
- Cleanup of partially scaffolded directories when scaffolding fails mid-way.
- Next-steps output adapts to what actually happened (install skipped/failed, in-place
  scaffold) and includes the docker + migrate steps.

## 1.0.0

Initial release: scaffold a pnpm + Turborepo monorepo with a Hono-on-Bun API, React
frontend, Bun worker, Prisma/Postgres, shared Zod schemas, a typed Hono RPC client,
Biome, Vitest, Docker Compose, and GitHub Actions CI.
