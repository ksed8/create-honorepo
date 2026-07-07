import { z } from 'zod';

// Vite exposes only env vars prefixed with VITE_.
// These are inlined at build time and visible in the bundled JS.
// Never put secrets in here.
const EnvSchema = z.object({
  VITE_API_URL: z.url(),
});

const parsed = EnvSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors);
  throw new Error('Invalid frontend environment configuration');
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
