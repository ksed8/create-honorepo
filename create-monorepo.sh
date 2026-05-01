#!/usr/bin/env bash

set -euo pipefail

# Argument parsing
INSTALL=0
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --install)
      INSTALL=1
      ;;
    -h|--help)
      cat <<USAGE
Usage: $0 <project-name> [scope] [--install]

Arguments:
  project-name   Lowercase letters, digits, and hyphens (required)
  scope          Package scope, e.g. @myorg (default: @<project-name>)

Options:
  --install      Run 'pnpm install' and 'pnpm setup:env' after scaffolding
  -h, --help     Show this help

Example:
  $0 my-platform @myorg --install
USAGE
      exit 0
      ;;
    *)
      POSITIONAL+=("$arg")
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -lt 1 ]]; then
  echo "Usage: $0 <project-name> [scope] [--install]"
  echo "Example: $0 my-platform @myorg --install"
  exit 1
fi

PROJECT_NAME="${POSITIONAL[0]}"
SCOPE="${POSITIONAL[1]:-@$PROJECT_NAME}"
ROOT_DIR="$PROJECT_NAME"

# Sanity checks
if [[ -d "$ROOT_DIR" ]]; then
  echo "Error: directory '$ROOT_DIR' already exists"
  exit 1
fi

if [[ ! "$PROJECT_NAME" =~ ^[a-z0-9-]+$ ]]; then
  echo "Error: project name must be lowercase letters, digits, and hyphens only"
  exit 1
fi

# Prerequisite checks (required tools)
missing=()
for cmd in git pnpm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    missing+=("$cmd")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: required tools not found: ${missing[*]}"
  echo
  echo "Install instructions:"
  for cmd in "${missing[@]}"; do
    case "$cmd" in
      git) echo "  git:    https://git-scm.com/downloads" ;;
      pnpm) echo "  pnpm:   corepack enable && corepack prepare pnpm@latest --activate" ;;
    esac
  done
  exit 1
fi

# Optional tools: warn but continue
optional_missing=()
for cmd in bun docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    optional_missing+=("$cmd")
  fi
done

if [[ ${#optional_missing[@]} -gt 0 ]]; then
  echo "Warning: optional tools not installed: ${optional_missing[*]}"
  for cmd in "${optional_missing[@]}"; do
    case "$cmd" in
      bun) echo "  bun     (needed to run apps/api and apps/worker): curl -fsSL https://bun.sh/install | bash" ;;
      docker) echo "  docker  (needed for local Postgres + Redis):     https://docs.docker.com/get-docker/" ;;
    esac
  done
  echo "Scaffolding will continue. Install these before running 'pnpm dev'."
  echo
fi

echo "Scaffolding monorepo: $PROJECT_NAME"
echo "Package scope: $SCOPE"
echo

# Directory structure
mkdir -p "$ROOT_DIR"/{apps,packages,.github/workflows}
mkdir -p "$ROOT_DIR"/apps/{web,api,worker}
mkdir -p "$ROOT_DIR"/packages/{config,db,shared-types,api-client}
mkdir -p "$ROOT_DIR"/packages/config/tsconfig

cd "$ROOT_DIR"

# scripts/ for repo-level helpers
mkdir -p scripts
cat > scripts/setup-env.mjs <<'EOF'
#!/usr/bin/env node
// Copies every .env.example in the workspace to .env, skipping files that already exist.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SEARCH_DIRS = ['apps', 'packages'];
let copied = 0;
let skipped = 0;

function findEnvExamples(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findEnvExamples(full));
    } else if (entry === '.env.example') {
      results.push(full);
    }
  }
  return results;
}

const examples = SEARCH_DIRS.flatMap((d) =>
  existsSync(join(ROOT, d)) ? findEnvExamples(join(ROOT, d)) : [],
);

for (const example of examples) {
  const target = example.replace(/\.example$/, '');
  if (existsSync(target)) {
    console.log(`skip   ${target} (exists)`);
    skipped++;
  } else {
    copyFileSync(example, target);
    console.log(`create ${target}`);
    copied++;
  }
}

console.log(`\nDone. Created ${copied}, skipped ${skipped}.`);
EOF

# .gitignore
cat > .gitignore <<'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.turbo/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/
EOF

# Node version pin (used by nvm, fnm, volta, etc.)
cat > .nvmrc <<'EOF'
20
EOF

# pnpm configuration
cat > .npmrc <<'EOF'
auto-install-peers=true
strict-peer-dependencies=false
engine-strict=true
EOF

# Root .env.example (shared)
cat > .env.example <<'EOF'
# Shared environment variables.
# Each app has its own .env.example with app-specific keys.
NODE_ENV=development
EOF

# Root package.json
cat > package.json <<EOF
{
  "name": "$PROJECT_NAME",
  "version": "0.0.1",
  "private": true,
  "description": "$PROJECT_NAME monorepo",
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate",
    "setup:env": "node scripts/setup-env.mjs",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
EOF

# pnpm workspace
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# Turborepo config
cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "db:generate": {
      "cache": true,
      "inputs": ["prisma/schema.prisma"],
      "outputs": ["node_modules/.prisma/**", "node_modules/@prisma/client/**"]
    },
    "build": {
      "dependsOn": ["^build", "^db:generate", "db:generate"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^db:generate", "db:generate"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^db:generate", "db:generate"]
    },
    "typecheck": {
      "dependsOn": ["^build", "^db:generate", "db:generate"]
    },
    "test": {
      "dependsOn": ["^build", "^db:generate", "db:generate"]
    },
    "clean": {
      "cache": false
    }
  }
}
EOF

# Root tsconfig (anchor only)
cat > tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": [],
  "files": []
}
EOF

# EditorConfig (consistent formatting across IDEs)
cat > .editorconfig <<'EOF'
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
EOF

# Vitest workspace config (lets `vitest` at root run all workspaces)
cat > vitest.workspace.ts <<'EOF'
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['packages/*', 'apps/*']);
EOF

# Biome configuration
cat > biome.json <<'EOF'
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": [
      "**/dist/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/build/**",
      "**/*.generated.*",
      "**/prisma/migrations/**"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "noNonNullAssertion": "off"
      },
      "suspicious": {
        "noConsoleLog": "off"
      },
      "correctness": {
        "noUnusedVariables": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always",
      "arrowParentheses": "always"
    }
  }
}
EOF

# Root README
cat > README.md <<EOF
# $PROJECT_NAME

A TypeScript fullstack monorepo scaffolded with pnpm workspaces and Turborepo.

## Prerequisites

- Node.js 20+
- pnpm 9+ (\`corepack enable && corepack prepare pnpm@latest --activate\`)
- Bun (\`curl -fsSL https://bun.sh/install | bash\`)
- Docker (for local Postgres and Redis)

## Getting started

\`\`\`bash
pnpm install                                          # installs deps + generates Prisma client
pnpm setup:env                                        # creates .env files from .env.example
docker compose up -d                                  # starts Postgres and Redis
pnpm --filter $SCOPE/db migrate:dev --name init       # creates initial DB migration
pnpm dev                                              # starts api and web
\`\`\`

The API runs on \`http://localhost:3001\` and the web app on \`http://localhost:5173\`.

## Project structure

- \`apps/web\` — React frontend (Vite), uses \`@scope/api-client\` for typed API calls
- \`apps/api\` — Hono API on Bun, with CORS, request logging, error handling, Zod env and request validation
- \`apps/worker\` — Background worker on Bun, ready to extend with a queue consumer
- \`packages/config\` — Shared TypeScript configs (base, react, node, bun)
- \`packages/db\` — Prisma schema and singleton client
- \`packages/shared-types\` — Cross-boundary Zod schemas and inferred TS types
- \`packages/api-client\` — Typed Hono RPC client used by the frontend

## Local services

\`docker-compose.yml\` runs Postgres and Redis for local dev.

\`\`\`bash
docker compose up -d   # start
docker compose down    # stop
docker compose logs -f # follow logs
\`\`\`

## Scripts

- \`pnpm dev\` — start all dev servers
- \`pnpm build\` — build all packages
- \`pnpm typecheck\` — TypeScript across all packages
- \`pnpm lint\` — Biome lint and format check
- \`pnpm lint:fix\` — Biome auto-fix
- \`pnpm format\` — Biome format
- \`pnpm test\` — run Vitest tests across all packages
- \`pnpm db:generate\` — regenerate Prisma client
- \`pnpm setup:env\` — copy every \`.env.example\` to \`.env\` (skips files that exist)
- \`pnpm --filter $SCOPE/db migrate:dev --name <name>\` — create and apply a Prisma migration
- \`pnpm --filter $SCOPE/db studio\` — open Prisma Studio

## Environment variables

Each app validates its own env on startup using Zod. If a required variable is missing or wrong shape, the app fails fast with a clear error.

- \`apps/api/src/env.ts\` — \`NODE_ENV\`, \`PORT\`, \`DATABASE_URL\`, \`CORS_ORIGIN\`, \`LOG_LEVEL\`
- \`apps/web/src/env.ts\` — \`VITE_API_URL\` (build-time, must be prefixed with \`VITE_\`)
- \`apps/worker/src/env.ts\` — \`NODE_ENV\`, \`DATABASE_URL\`, \`REDIS_URL\`

Run \`pnpm setup:env\` after install to create \`.env\` files from each \`.env.example\`.

## Type-safe API calls

The API exports its route shape as \`AppType\`, which \`@scope/api-client\` consumes via Hono RPC. This means the frontend gets full autocomplete and type-checking for every API endpoint, request body, and response shape, with no codegen step.

\`\`\`ts
import { createApiClient } from '$SCOPE/api-client';
const api = createApiClient(env.VITE_API_URL);
const res = await api.echo.\$post({ json: { message: 'hi' } });
const data = await res.json(); // typed
\`\`\`

When you add a new route to the API, the frontend client picks it up automatically through TypeScript inference.
EOF

# packages/config (shared TS configs)
cat > packages/config/package.json <<EOF
{
  "name": "$SCOPE/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig/base.json": "./tsconfig/base.json",
    "./tsconfig/react.json": "./tsconfig/react.json",
    "./tsconfig/node.json": "./tsconfig/node.json",
    "./tsconfig/bun.json": "./tsconfig/bun.json"
  }
}
EOF

cat > packages/config/tsconfig/base.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true
  }
}
EOF

cat > packages/config/tsconfig/react.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
EOF

cat > packages/config/tsconfig/node.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
EOF

cat > packages/config/tsconfig/bun.json <<'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["bun"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  }
}
EOF

# packages/shared-types (Zod schemas + inferred TS types)
cat > packages/shared-types/package.json <<EOF
{
  "name": "$SCOPE/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
EOF

cat > packages/shared-types/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p packages/shared-types/src/schemas

cat > packages/shared-types/src/index.ts <<'EOF'
// Public exports for shared schemas and types.
export * from './schemas/example.js';
EOF

cat > packages/shared-types/src/schemas/example.ts <<'EOF'
import { z } from 'zod';

// Example schema. Replace with your real domain schemas.
// Pattern: define schema with z, infer the TS type with z.infer.
export const ExampleSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1).max(280),
  createdAt: z.coerce.date(),
});

export type Example = z.infer<typeof ExampleSchema>;
EOF

cat > packages/shared-types/src/schemas/example.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { ExampleSchema } from './example.js';

describe('ExampleSchema', () => {
  it('parses valid input', () => {
    const result = ExampleSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      message: 'hello',
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid', () => {
    const result = ExampleSchema.safeParse({
      id: 'not-a-uuid',
      message: 'hello',
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
EOF

# packages/db (Prisma)
cat > packages/db/package.json <<EOF
{
  "name": "$SCOPE/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "postinstall": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "typecheck": "tsc --noEmit",
    "test": "echo 'no tests'"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "@types/node": "^22.0.0",
    "prisma": "^5.22.0",
    "typescript": "^5.7.0"
  }
}
EOF

cat > packages/db/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p packages/db/prisma packages/db/src

cat > packages/db/prisma/schema.prisma <<'EOF'
// Starter schema. Replace with your real models.
// Run `pnpm --filter <scope>/db migrate:dev --name <change-name>` after editing.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
EOF

cat > packages/db/src/index.ts <<'EOF'
import { PrismaClient } from '@prisma/client';

// Singleton pattern, prevents creating multiple clients in dev with hot reload.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
EOF

cat > packages/db/.env.example <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
EOF


# packages/api-client (typed Hono RPC client for the frontend)
cat > packages/api-client/package.json <<EOF
{
  "name": "$SCOPE/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "echo 'no tests'"
  },
  "dependencies": {
    "$SCOPE/api": "workspace:*",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
EOF

cat > packages/api-client/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true,
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p packages/api-client/src
cat > packages/api-client/src/index.ts <<'EOF'
import type { AppType } from '@SCOPE_PLACEHOLDER/api/routes';
import { hc } from 'hono/client';

// Typed API client. Pass the API base URL when constructing.
// The returned client is fully typed against the API's routes via Hono RPC.
//
// Example usage in the frontend:
//   import { createApiClient } from '@scope/api-client';
//   const api = createApiClient(import.meta.env.VITE_API_URL);
//   const res = await api.echo.$post({ json: { message: 'hi' } });
//   const data = await res.json();
export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl);
}

export type ApiClient = ReturnType<typeof createApiClient>;
EOF

# Replace placeholder with actual scope (sed -i differs on macOS vs Linux, use portable form)
sed -i.bak "s|@SCOPE_PLACEHOLDER|${SCOPE}|g" packages/api-client/src/index.ts && rm packages/api-client/src/index.ts.bak

# apps/api (Bun + Hono + Zod env + Vitest)
cat > apps/api/package.json <<EOF
{
  "name": "$SCOPE/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "bun": ">=1.1.0"
  },
  "exports": {
    "./routes": "./src/routes.ts"
  },
  "scripts": {
    "dev": "bun --watch run src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir=dist",
    "start": "bun run dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "$SCOPE/db": "workspace:*",
    "$SCOPE/shared-types": "workspace:*",
    "@hono/zod-validator": "^0.4.0",
    "hono": "^4.6.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "@types/bun": "^1.1.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
EOF

cat > apps/api/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/bun.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p apps/api/src

cat > apps/api/src/env.ts <<'EOF'
import { z } from 'zod';

// Zod-validated env. Fails fast at startup if anything is missing or wrong shape.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
EOF

cat > apps/api/src/routes.ts <<'EOF'
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

// Route definitions live here, separate from server bootstrap,
// so @scope/api-client can import AppType without pulling in
// Node-specific code (env, process, etc.).
export function buildRoutes() {
  return new Hono()
    .get('/', (c) => c.json({ status: 'ok', service: 'api' }))
    .get('/health', (c) => c.json({ status: 'healthy' }))
    .post(
      '/echo',
      zValidator(
        'json',
        z.object({
          message: z.string().min(1).max(280),
        }),
      ),
      (c) => {
        const { message } = c.req.valid('json');
        return c.json({ echoed: message });
      },
    );
}

// Type used by @scope/api-client for end-to-end type safety.
export type AppType = ReturnType<typeof buildRoutes>;
EOF

cat > apps/api/src/index.ts <<'EOF'
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { buildRoutes } from './routes.js';

const app = new Hono().use('*', logger()).use(
  '*',
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);

app.route('/', buildRoutes());

app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

app.onError((err, c) => {
  console.error(err);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json(
    {
      error: 'Internal server error',
      message: env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500,
  );
});

console.log(`API listening on http://localhost:${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
EOF

cat > apps/api/src/index.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

// Stand-alone test that doesn't depend on env loading.
// For full route tests, build a small test harness that mounts routes onto
// a fresh Hono instance and use app.request() to invoke them.
describe('api smoke', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
EOF

cat > apps/api/.env.example <<'EOF'
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
EOF


# apps/web (Vite + React + Zod env + Vitest)
cat > apps/web/package.json <<EOF
{
  "name": "$SCOPE/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "$SCOPE/api-client": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
EOF

cat > apps/web/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/react.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

cat > apps/web/vite.config.ts <<'EOF'
/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Provide env defaults during tests so env.ts doesn't fail.
    // Real values come from .env in dev/build.
    env: {
      VITE_API_URL: 'http://localhost:3001',
    },
  },
});
EOF

cat > apps/web/index.html <<EOF
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>$PROJECT_NAME</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

mkdir -p apps/web/src

cat > apps/web/src/env.ts <<'EOF'
import { z } from 'zod';

// Vite exposes only env vars prefixed with VITE_.
// These are inlined at build time and visible in the bundled JS.
// Never put secrets in here.
const EnvSchema = z.object({
  VITE_API_URL: z.string().url(),
});

const parsed = EnvSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid frontend environment configuration');
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
EOF

cat > apps/web/src/main.tsx <<'EOF'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
EOF

cat > apps/web/src/App.tsx <<EOF
import { createApiClient } from '$SCOPE/api-client';
import { useEffect, useState } from 'react';
import { env } from './env.js';

const api = createApiClient(env.VITE_API_URL);

function App() {
  const [health, setHealth] = useState<string>('checking...');

  useEffect(() => {
    api.health
      .\$get()
      .then((r) => r.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth('unreachable'));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>$PROJECT_NAME</h1>
      <p>Web app skeleton, ready to build on.</p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        API: {env.VITE_API_URL} ({health})
      </p>
    </div>
  );
}

export default App;
EOF

cat > apps/web/src/App.test.tsx <<'EOF'
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.js';

describe('App', () => {
  it('renders heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
EOF

cat > apps/web/src/test-setup.ts <<'EOF'
import '@testing-library/jest-dom/vitest';
EOF

cat > apps/web/src/vite-env.d.ts <<'EOF'
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
EOF

cat > apps/web/.env.example <<'EOF'
VITE_API_URL=http://localhost:3001
EOF


# apps/worker (Bun background worker + Zod env + Vitest)
cat > apps/worker/package.json <<EOF
{
  "name": "$SCOPE/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "bun": ">=1.1.0"
  },
  "scripts": {
    "dev": "bun --watch run src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir=dist",
    "start": "bun run dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "$SCOPE/db": "workspace:*",
    "$SCOPE/shared-types": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "$SCOPE/config": "workspace:*",
    "@types/bun": "^1.1.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
EOF

cat > apps/worker/tsconfig.json <<EOF
{
  "extends": "$SCOPE/config/tsconfig/bun.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

mkdir -p apps/worker/src

cat > apps/worker/src/env.ts <<'EOF'
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
EOF

cat > apps/worker/src/index.ts <<'EOF'
import { env } from './env.js';

// Replace with a real worker loop, e.g. BullMQ consumer or scheduled task.
console.log('Worker started');
console.log(`NODE_ENV=${env.NODE_ENV}`);

// Keep process alive in dev so --watch behaves predictably.
setInterval(() => {
  // Heartbeat. Replace with real work.
}, 60_000);
EOF

cat > apps/worker/src/index.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';

describe('worker smoke', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
EOF

cat > apps/worker/.env.example <<'EOF'
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
REDIS_URL=redis://localhost:6379
EOF


# Per-package READMEs (one-line description + how to run)
cat > apps/api/README.md <<EOF
# api

Hono API on Bun runtime. Validates env via Zod, validates request bodies via @hono/zod-validator, exports \`AppType\` for end-to-end type safety with the frontend.

\`\`\`bash
pnpm dev      # http://localhost:3001
pnpm test
pnpm build
\`\`\`
EOF

cat > apps/web/README.md <<EOF
# web

React + Vite frontend. Calls the API via the typed \`${SCOPE}/api-client\` (Hono RPC).

\`\`\`bash
pnpm dev      # http://localhost:5173
pnpm test
pnpm build
\`\`\`
EOF

cat > apps/worker/README.md <<EOF
# worker

Background worker on Bun. Replace the heartbeat in \`src/index.ts\` with a real consumer (BullMQ, scheduled task, etc.).

\`\`\`bash
pnpm dev
pnpm test
pnpm build
\`\`\`
EOF

cat > packages/db/README.md <<EOF
# db

Prisma schema and singleton client. Used by both api and worker.

\`\`\`bash
pnpm db:generate            # regenerate Prisma client (run after editing schema.prisma)
pnpm migrate:dev --name foo # create and apply a migration locally
pnpm migrate:deploy         # apply pending migrations in production
pnpm studio                 # browse data in Prisma Studio
\`\`\`
EOF

cat > packages/shared-types/README.md <<EOF
# shared-types

Zod schemas and inferred TypeScript types shared across api, worker, and web. The pattern: define a schema with z, infer the type with \`z.infer\`, export both.
EOF

cat > packages/api-client/README.md <<EOF
# api-client

Typed Hono RPC client. Re-exports \`createApiClient(baseUrl)\` which returns a fully-typed client based on the API's \`AppType\`. Used by the web app.
EOF

cat > packages/config/README.md <<EOF
# config

Shared TypeScript configs. Other packages extend the appropriate one in their tsconfig.json: \`base\` (no DOM/Node), \`react\`, \`node\`, or \`bun\`.
EOF

# Docker Compose for local Postgres + Redis
cat > docker-compose.yml <<EOF
services:
  postgres:
    image: postgres:16-alpine
    container_name: ${PROJECT_NAME}-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ${PROJECT_NAME}-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
  redis-data:
EOF

# GitHub Dependabot (weekly dependency updates)
cat > .github/dependabot.yml <<'EOF'
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    groups:
      dev-dependencies:
        dependency-type: development
      production-dependencies:
        dependency-type: production

  - package-ecosystem: github-actions
    directory: "/"
    schedule:
      interval: weekly
EOF

# GitHub Actions CI
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Lint, typecheck, test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm db:generate

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
EOF

# Initialise git repo and create initial commit
echo
echo "Initialising git repository..."
git init --quiet --initial-branch=main
git add .

# Use the user's git identity if configured; otherwise fall back so the commit
# doesn't fail on a fresh machine. The fallback is local to this commit only.
if git config --get user.email >/dev/null 2>&1 && git config --get user.name >/dev/null 2>&1; then
  git commit --quiet -m "chore: initial scaffold"
else
  echo "Note: git user.name / user.email not set globally — using a local fallback for the initial commit."
  git -c user.name="Scaffolder" -c user.email="scaffolder@local" \
    commit --quiet -m "chore: initial scaffold"
fi

# Optional automated install
if [[ "$INSTALL" -eq 1 ]]; then
  echo
  echo "Running pnpm install (this also generates the Prisma client)..."
  pnpm install

  echo
  echo "Creating .env files from .env.example..."
  pnpm setup:env

  echo
  echo "Re-staging and amending the initial commit to include the lockfile..."
  git add pnpm-lock.yaml >/dev/null 2>&1 || true
  if ! git diff --cached --quiet; then
    git commit --quiet --amend --no-edit
  fi
fi

cd ..

echo
echo "Done. Created $ROOT_DIR/ with initial git commit on 'main'."
echo

if [[ "$INSTALL" -eq 1 ]]; then
  echo "Dependencies installed and env files created."
  echo
  echo "Next steps:"
  echo "  cd $PROJECT_NAME"
  echo "  docker compose up -d                                  # start Postgres + Redis"
  echo "  pnpm --filter $SCOPE/db migrate:dev --name init       # create initial migration"
  echo "  pnpm dev                                              # start api + web"
else
  echo "Next steps:"
  echo "  cd $PROJECT_NAME"
  echo "  pnpm install                                          # installs deps + generates Prisma client"
  echo "  pnpm setup:env                                        # creates .env files"
  echo "  docker compose up -d                                  # start Postgres + Redis"
  echo "  pnpm --filter $SCOPE/db migrate:dev --name init       # create initial migration"
  echo "  pnpm dev                                              # start api + web"
  echo
  echo "  (or re-run this script with --install to do the first two steps automatically)"
fi

echo
echo "Then verify:"
echo "  curl http://localhost:3001/health"
echo "  open http://localhost:5173"
echo
echo "To push to a remote:"
echo "  git remote add origin <your-remote-url>"
echo "  git push -u origin main"