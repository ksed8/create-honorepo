import { describe, expect, test } from 'bun:test';
import { detectEatenFlags } from '../src/prompts.js';

describe('detectEatenFlags (npm 7+ env vars)', () => {
  test('returns null outside npm', () => {
    expect(detectEatenFlags({ npm_config_user_agent: 'pnpm/11.0.0 npm/? node/v22' }, [])).toBeNull();
    expect(detectEatenFlags({}, [])).toBeNull();
  });

  test('reconstructs an eaten --scope', () => {
    const env = { npm_config_user_agent: 'npm/10.9.0 node/v22.0.0', npm_config_scope: '@acme' };
    expect(detectEatenFlags(env, ['my-app'])).toBe('--scope acme');
  });

  test('reconstructs eaten boolean flags', () => {
    const env = {
      npm_config_user_agent: 'npm/10.9.0 node/v22.0.0',
      npm_config_yes: 'true',
      npm_config_install: 'false',
    };
    expect(detectEatenFlags(env, ['my-app'])).toBe('--yes --no-install');
  });

  test('reconstructs an eaten --no-scope', () => {
    const env = { npm_config_user_agent: 'npm/10.9.0 node/v22.0.0', npm_config_scope: 'false' };
    expect(detectEatenFlags(env, ['my-app'])).toBe('--no-scope');
  });

  test('skips flags that did reach argv', () => {
    const env = { npm_config_user_agent: 'npm/10.9.0 node/v22.0.0', npm_config_scope: '@acme' };
    expect(detectEatenFlags(env, ['my-app', '--scope', 'acme'])).toBeNull();
  });

  test('supports the legacy npm_config_argv format', () => {
    const env = {
      npm_config_argv: JSON.stringify({ original: ['create', 'honorepo', 'my-app', '--git'] }),
    };
    expect(detectEatenFlags(env, ['my-app'])).toBe('--git');
  });
});
