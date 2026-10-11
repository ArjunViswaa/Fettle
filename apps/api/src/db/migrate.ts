import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/** Waits for Postgres (the embedded server may still be booting), then applies pending migrations. */
export async function migrateDatabase({ timeoutMs = 90_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('select 1');
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      if (attempt === 1) console.log('Waiting for Postgres...');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  // Advisory lock so two processes starting at once don't both migrate.
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock(337851)');
    await migrate(db, { migrationsFolder });
  } finally {
    await client.query('select pg_advisory_unlock(337851)').catch(() => {});
    client.release();
  }
}
