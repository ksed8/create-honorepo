// Prisma CLI configuration (Prisma 7+). The CLI no longer loads .env on its own,
// so dotenv must be imported here for migrate/studio to see DATABASE_URL.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Falls back to the docker-compose default so `prisma generate` works during
    // `pnpm install`, before any .env file exists.
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/app',
  },
});
