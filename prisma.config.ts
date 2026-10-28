import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadDotenv({ quiet: true });

/**
 * Prisma CLI configuration.
 *
 * `DATABASE_URL` is optional here so that `prisma generate` (run on install)
 * works without a database; `prisma migrate` commands need it to be set.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
});
