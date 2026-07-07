import { describe, expect, it } from 'vitest';
import { buildRoutes } from './routes.js';

// routes.ts is env-free by design, so routes can be tested without booting the server.
describe('api routes', () => {
  const app = buildRoutes();

  it('GET /health reports healthy', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'healthy' });
  });

  it('POST /echo returns the message', async () => {
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ echoed: 'hi' });
  });

  it('POST /echo rejects an empty message', async () => {
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    expect(res.status).toBe(400);
  });
});
