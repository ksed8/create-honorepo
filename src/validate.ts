import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const NAME_REGEX = /^[a-z][a-z0-9-]*$/;
const NAME_MAX_LENGTH = 214;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateName(name: string): ValidationResult {
  if (!name) return { ok: false, reason: 'Project name is required.' };
  if (name.length > NAME_MAX_LENGTH) {
    return { ok: false, reason: `Project name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!NAME_REGEX.test(name)) {
    return {
      ok: false,
      reason: 'Project name must be lowercase letters, digits, and hyphens, starting with a letter.',
    };
  }
  return { ok: true };
}

export function normalizeScope(scope: string): string {
  return scope.startsWith('@') ? scope.slice(1) : scope;
}

export function validateScope(scope: string): ValidationResult {
  const normalized = normalizeScope(scope);
  if (!normalized) return { ok: true };
  if (!NAME_REGEX.test(normalized)) {
    return {
      ok: false,
      reason: 'Scope must be lowercase letters, digits, and hyphens, starting with a letter.',
    };
  }
  return { ok: true };
}

export type DirCheckResult = { ok: true } | { ok: false; entries: string[] };

// A pre-created git repo or OS metadata shouldn't block scaffolding
// (e.g. a freshly cloned empty GitHub repo used with `create-honorepo .`).
const IGNORABLE_ENTRIES = new Set(['.git', '.DS_Store']);

export function assertTargetDirEmpty(targetDir: string): DirCheckResult {
  const resolved = resolve(targetDir);
  if (!existsSync(resolved)) return { ok: true };
  if (!statSync(resolved).isDirectory()) {
    return { ok: false, entries: [`${resolved} exists and is not a directory`] };
  }
  const entries = readdirSync(resolved).filter((entry) => !IGNORABLE_ENTRIES.has(entry));
  if (entries.length === 0) return { ok: true };
  return { ok: false, entries };
}
