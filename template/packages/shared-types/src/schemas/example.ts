import { z } from 'zod';

// Example schema. Replace with your real domain schemas.
// Pattern: define schema with z, infer the TS type with z.infer.
export const ExampleSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1).max(280),
  createdAt: z.coerce.date(),
});

export type Example = z.infer<typeof ExampleSchema>;
