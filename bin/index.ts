#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { run } from '../src/cli.js';

const HELP = `Usage:
  npm create monorepo <project-name> [options]

Arguments:
  <project-name>     Lowercase letters, digits, hyphens

Options:
  --scope <name>     Package scope (e.g. acme → @acme/web)
  --no-scope         Force unscoped names
  --install          Install dependencies after scaffolding
  --no-install       Skip installation
  --git              Initialize a git repository
  --no-git           Skip git initialization
  -y, --yes          Accept all defaults; non-interactive
  -h, --help         Show this help
  -v, --version      Show CLI version

Examples:
  npm create monorepo my-app
  npm create monorepo my-app -- --scope acme --no-install
  npm create monorepo my-app -- -y
`;

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: false,
  options: {
    scope: { type: 'string' },
    'no-scope': { type: 'boolean' },
    install: { type: 'boolean' },
    'no-install': { type: 'boolean' },
    git: { type: 'boolean' },
    'no-git': { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
});

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (values.version) {
  process.stdout.write(readVersion() + '\n');
  process.exit(0);
}

const name = positionals[0];

let scope: string | undefined;
if (values['no-scope']) scope = '';
else if (typeof values.scope === 'string') scope = values.scope;

let install: boolean | undefined;
if (values['no-install']) install = false;
else if (values.install) install = true;

let git: boolean | undefined;
if (values['no-git']) git = false;
else if (values.git) git = true;

run({
  name,
  scope,
  install,
  git,
  yes: Boolean(values.yes),
}).then(
  (code) => process.exit(code),
  (err: unknown) => {
    const e = err as { stack?: string };
    process.stderr.write('\n' + (e?.stack ?? String(err)) + '\n');
    process.exit(1);
  },
);
