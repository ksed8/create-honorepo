import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaffold, substitute } from '../src/scaffold.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TEMPLATE_DIR = join(ROOT, 'template');
const FIXTURE_PATH = join(HERE, 'fixtures', 'scaffold-snapshot.json');

const FIXTURE_VARS = {
  projectName: 'snapshot-fixture',
  scope: 'snapshot-fixture',
};

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function snapshotDir(dir: string): Record<string, string> {
  const snapshot: Record<string, string> = {};
  walk(dir, dir, snapshot);
  return snapshot;
}

function walk(root: string, current: string, out: Record<string, string>): void {
  for (const entry of readdirSync(current)) {
    const full = join(current, entry);
    const rel = relative(root, full);
    if (statSync(full).isDirectory()) {
      walk(root, full, out);
    } else {
      out[rel] = hashFile(full);
    }
  }
}

describe('substitute', () => {
  test('replaces __projectName__', () => {
    expect(substitute('hello __projectName__', { projectName: 'my-app', scope: 's' })).toBe('hello my-app');
  });

  test('replaces __scope__', () => {
    expect(substitute('@__scope__/web', { projectName: 'p', scope: 'acme' })).toBe('@acme/web');
  });

  test('replaces multiple occurrences', () => {
    expect(substitute('__scope__/__scope__', { projectName: 'p', scope: 'a' })).toBe('a/a');
  });

  test('leaves unrelated text untouched', () => {
    expect(substitute('no placeholders here', { projectName: 'p', scope: 's' })).toBe('no placeholders here');
  });

  test('empty scope turns @__scope__/ into a project-name prefix', () => {
    expect(substitute('"@__scope__/web": "workspace:*"', { projectName: 'my-app', scope: '' })).toBe(
      '"my-app-web": "workspace:*"',
    );
    expect(substitute("from '@__scope__/api-client'", { projectName: 'my-app', scope: '' })).toBe(
      "from 'my-app-api-client'",
    );
  });

  test('empty scope falls back to project name for bare __scope__ tokens', () => {
    expect(substitute('__scope__', { projectName: 'my-app', scope: '' })).toBe('my-app');
  });
});

describe('scaffold (snapshot)', () => {
  test('produces deterministic output matching fixture', () => {
    const target = mkdtempSync(join(tmpdir(), 'ch-scaffold-'));
    const outDir = join(target, 'app');
    scaffold(TEMPLATE_DIR, outDir, FIXTURE_VARS);

    const actual = snapshotDir(outDir);

    if (process.env.UPDATE_SNAPSHOTS === '1') {
      writeFileSync(FIXTURE_PATH, JSON.stringify(actual, null, 2) + '\n');
      return;
    }
    if (!existsSync(FIXTURE_PATH)) {
      throw new Error(
        `Snapshot fixture missing at ${FIXTURE_PATH}. Run: UPDATE_SNAPSHOTS=1 bun test tests/`,
      );
    }

    const expected = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, string>;
    expect(actual).toEqual(expected);
  });

  test('renames _-prefixed dotfiles', () => {
    const target = mkdtempSync(join(tmpdir(), 'ch-dot-'));
    const outDir = join(target, 'app');
    scaffold(TEMPLATE_DIR, outDir, FIXTURE_VARS);

    expect(existsSync(join(outDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(outDir, '.npmrc'))).toBe(true);
    expect(existsSync(join(outDir, '.nvmrc'))).toBe(true);
    expect(existsSync(join(outDir, '.editorconfig'))).toBe(true);
    expect(existsSync(join(outDir, '.env.example'))).toBe(true);
    expect(existsSync(join(outDir, '.github', 'workflows', 'ci.yml'))).toBe(true);
    expect(existsSync(join(outDir, '_gitignore'))).toBe(false);
    expect(existsSync(join(outDir, '_github'))).toBe(false);
  });

  test('substitutes placeholders in generated files', () => {
    const target = mkdtempSync(join(tmpdir(), 'ch-sub-'));
    const outDir = join(target, 'app');
    scaffold(TEMPLATE_DIR, outDir, { projectName: 'demo', scope: 'demo' });

    const rootPkg = readFileSync(join(outDir, 'package.json'), 'utf8');
    expect(rootPkg).toContain('"name": "demo"');
    expect(rootPkg).toContain('@demo/config');
    expect(rootPkg).not.toContain('__projectName__');
    expect(rootPkg).not.toContain('__scope__');

    const webPkg = readFileSync(join(outDir, 'apps', 'web', 'package.json'), 'utf8');
    expect(webPkg).toContain('"name": "@demo/web"');
  });

  test('empty scope produces prefixed names with no residue anywhere', () => {
    const target = mkdtempSync(join(tmpdir(), 'ch-noscope-'));
    const outDir = join(target, 'app');
    scaffold(TEMPLATE_DIR, outDir, { projectName: 'demo', scope: '' });

    const rootPkg = readFileSync(join(outDir, 'package.json'), 'utf8');
    expect(rootPkg).toContain('"name": "demo"');
    expect(rootPkg).toContain('"demo-config"');

    const webPkg = readFileSync(join(outDir, 'apps', 'web', 'package.json'), 'utf8');
    expect(webPkg).toContain('"name": "demo-web"');

    // No file may contain a broken "@/name" or a leftover token.
    for (const rel of Object.keys(snapshotDir(outDir))) {
      const content = readFileSync(join(outDir, rel));
      if (!rel.match(/\.(ts|tsx|json|md|yaml|yml|prisma|html|css|example)$/)) continue;
      const text = content.toString('utf8');
      expect(text).not.toContain('__scope__');
      expect(text).not.toContain('"@/');
    }
  });
});
