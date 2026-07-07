# db

Prisma schema and singleton client. Used by both api and worker.

- `prisma/schema.prisma` — models and the `prisma-client` generator. The client is generated
  into `src/generated/` (gitignored; recreated on `pnpm install` via the `postinstall` script).
- `prisma.config.ts` — Prisma CLI config. It loads `.env` (the CLI no longer does this itself)
  and provides `DATABASE_URL` to migrate/studio.
- `src/index.ts` — the shared `PrismaClient` singleton, connected through the
  `@prisma/adapter-pg` driver adapter.

```bash
pnpm db:generate            # regenerate Prisma client (run after editing schema.prisma)
pnpm migrate:dev --name foo # create and apply a migration locally
pnpm migrate:deploy         # apply pending migrations in production
pnpm studio                 # browse data in Prisma Studio
```
