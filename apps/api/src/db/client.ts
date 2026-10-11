import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of shifting them through JS Dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
// Counts and sums come back as int8/numeric strings; every value we aggregate fits in a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_SIZE });

export const db = drizzle(pool, { schema, casing: 'snake_case' });
export type Db = typeof db;

export { schema };
