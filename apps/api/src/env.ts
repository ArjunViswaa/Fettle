import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const envFile = path.join(repoRoot, '.env');
if (existsSync(envFile)) loadDotenv({ path: envFile, quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Leave unset to use the PostgreSQL server that Fettle runs itself (data in .data/postgres). */
  DATABASE_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  EMBEDDED_PG_PORT: z.coerce.number().int().default(54330),
  EMBEDDED_PG_PASSWORD: z.string().default('fettle-local'),
  EMBEDDED_PG_DIR: z.string().default(path.join(repoRoot, '.data', 'postgres')),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  API_PORT: z.coerce.number().int().default(4100),
  API_HOST: z.string().default('127.0.0.1'),
  /** Where the browser opens the app. Defaults to Vite in development, the API's own port in production. */
  APP_URL: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters. See .env.example.'),
  ALLOW_SIGNUP: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
  LOG_LEVEL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  APP_URL:
    parsed.data.APP_URL ??
    (parsed.data.NODE_ENV === 'production' ? `http://localhost:${parsed.data.API_PORT}` : 'http://localhost:5174'),
  DATABASE_URL:
    parsed.data.DATABASE_URL ??
    `postgres://postgres:${encodeURIComponent(parsed.data.EMBEDDED_PG_PASSWORD)}@127.0.0.1:${parsed.data.EMBEDDED_PG_PORT}/fettle`,
  usingEmbeddedDb: !parsed.data.DATABASE_URL,
};
