import { describe, expect, test } from 'bun:test';
import {
  assertTargetDirEmpty,
  normalizeScope,
  validateName,
  validateScope,
} from '../src/validate.js';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('validateName', () => {
  test('accepts simple lowercase name', () => {
    expect(validateName('myapp').ok).toBe(true);
  });

  test('accepts kebab-case name', () => {
    expect(validateName('my-app').ok).toBe(true);
  });

  test('accepts name with digits', () => {
    expect(validateName('my-app2').ok).toBe(true);
  });

  test('rejects empty name', () => {
    expect(validateName('').ok).toBe(false);
  });

  test('rejects name with uppercase', () => {
    const result = validateName('MyApp');
    expect(result.ok).toBe(false);
  });

  test('rejects name with spaces', () => {
    expect(validateName('my app').ok).toBe(false);
  });

  test('rejects name starting with digit', () => {
    expect(validateName('1app').ok).toBe(false);
  });

  test('rejects name starting with hyphen', () => {
    expect(validateName('-app').ok).toBe(false);
  });

  test('rejects name with underscore', () => {
    expect(validateName('my_app').ok).toBe(false);
  });

  test('rejects reserved name node_modules', () => {
    expect(validateName('node_modules').ok).toBe(false);
  });

  test('rejects overlong name', () => {
    expect(validateName('a'.repeat(215)).ok).toBe(false);
  });

  test('accepts maximum-length name', () => {
    const name = 'a' + 'b'.repeat(213);
    expect(validateName(name).ok).toBe(true);
  });
});

describe('normalizeScope', () => {
  test('strips leading @', () => {
    expect(normalizeScope('@acme')).toBe('acme');
  });

  test('passes through bare scope', () => {
    expect(normalizeScope('acme')).toBe('acme');
  });

  test('preserves empty input', () => {
    expect(normalizeScope('')).toBe('');
  });

  test('only strips first @', () => {
    expect(normalizeScope('@@acme')).toBe('@acme');
  });
});

describe('validateScope', () => {
  test('accepts empty scope', () => {
    expect(validateScope('').ok).toBe(true);
  });

  test('accepts bare scope', () => {
    expect(validateScope('acme').ok).toBe(true);
  });

  test('accepts @-prefixed scope', () => {
    expect(validateScope('@acme').ok).toBe(true);
  });

  test('rejects scope with uppercase', () => {
    expect(validateScope('Acme').ok).toBe(false);
  });

  test('rejects scope starting with digit', () => {
    expect(validateScope('1acme').ok).toBe(false);
  });
});

describe('assertTargetDirEmpty', () => {
  test('passes when dir does not exist', () => {
    const dir = join(tmpdir(), `cm-test-${Date.now()}-${Math.random()}`);
    expect(assertTargetDirEmpty(dir).ok).toBe(true);
  });

  test('passes when dir exists and is empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-empty-'));
    expect(assertTargetDirEmpty(dir).ok).toBe(true);
  });

  test('fails when dir exists with files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-nonempty-'));
    writeFileSync(join(dir, 'a.txt'), 'hi');
    const result = assertTargetDirEmpty(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.entries).toContain('a.txt');
    }
  });

  test('fails when path is a file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cm-file-'));
    const filePath = join(dir, 'file');
    writeFileSync(filePath, '');
    expect(assertTargetDirEmpty(filePath).ok).toBe(false);
  });
});
