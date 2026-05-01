import { describe, expect, it } from 'vitest';

// Stand-alone test that doesn't depend on env loading.
// For full route tests, build a small test harness that mounts routes onto
// a fresh Hono instance and use app.request() to invoke them.
describe('api smoke', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
