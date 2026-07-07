import type { AppType } from '@__scope__/api/routes';
import { hc } from 'hono/client';

// Typed API client. Pass the API base URL when constructing.
// The returned client is fully typed against the API's routes via Hono RPC.
//
// Example usage in the frontend:
//   import { createApiClient } from '@__scope__/api-client';
//   const api = createApiClient(import.meta.env.VITE_API_URL);
//   const res = await api.echo.$post({ json: { message: 'hi' } });
//   const data = await res.json();
export function createApiClient(baseUrl: string) {
  return hc<AppType>(baseUrl);
}

export type ApiClient = ReturnType<typeof createApiClient>;
