# db

Prisma schema and singleton client. Used by both api and worker.

```bash
pnpm db:generate            # regenerate Prisma client (run after editing schema.prisma)
pnpm migrate:dev --name foo # create and apply a migration locally
pnpm migrate:deploy         # apply pending migrations in production
pnpm studio                 # browse data in Prisma Studio
```
