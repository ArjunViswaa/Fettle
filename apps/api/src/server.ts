import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { pool } from './db/client.js';
import { migrateDatabase } from './db/migrate.js';
import { seedFoodCatalogue } from './db/seed-foods.js';
import { env, repoRoot } from './env.js';
import { watchLauncher } from './lib/watchdog.js';

const pidFile = path.join(repoRoot, '.data', 'api.pid');

await migrateDatabase();
await seedFoodCatalogue();

const app = await buildApp();
await listen();
mkdirSync(path.dirname(pidFile), { recursive: true });
writeFileSync(pidFile, String(process.pid));
console.log(`Fettle API listening on http://${env.API_HOST}:${env.API_PORT}`);

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await app.close();
  await pool.end();
  if (readPid() === process.pid) rmSync(pidFile, { force: true });
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

watchLauncher(async () => {
  console.log('Launcher is gone; shutting down.');
  // In dev the parent is `tsx watch`, which would otherwise sit waiting for file changes forever.
  if (process.env.FETTLE_STOP_PARENT === '1') {
    try {
      process.kill(process.ppid);
    } catch {
      // parent already gone
    }
  }
  await shutdown();
});

/**
 * On Windows an abruptly closed terminal can leave the previous API running and holding the port.
 * If the pid file says that process is ours, stop it and take over; otherwise explain and exit.
 */
async function listen() {
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    const stale = readPid();
    if (!stale || stale === process.pid) {
      console.error(`Port ${env.API_PORT} is used by another program. Close it or set API_PORT in .env.`);
      process.exit(1);
    }
    console.log('A Fettle server from a previous session is still running; replacing it.');
    try {
      process.kill(stale);
    } catch {
      // already gone
    }
    await new Promise((r) => setTimeout(r, 1500));
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  }
}

function readPid(): number | null {
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}
