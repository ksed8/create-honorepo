import { describe, expect, it } from 'vitest';
import { ExampleSchema } from './example.js';

describe('ExampleSchema', () => {
  it('parses valid input', () => {
    const result = ExampleSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      message: 'hello',
      createdAt: '2024-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid uuid', () => {
    const result = ExampleSchema.safeParse({
      id: 'not-a-uuid',
      message: 'hello',
      createdAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});
