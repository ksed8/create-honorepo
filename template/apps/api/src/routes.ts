import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

// Route definitions live here, separate from server bootstrap,
// so @__scope__/api-client can import AppType without pulling in
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

// Type used by @__scope__/api-client for end-to-end type safety.
export type AppType = ReturnType<typeof buildRoutes>;
