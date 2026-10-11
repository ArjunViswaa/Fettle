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
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is not set. Run `npm run db:setup` to create the database on your local PostgreSQL.'),
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
};
