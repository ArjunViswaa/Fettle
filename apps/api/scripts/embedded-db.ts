/**
 * Runs a real Postgres server from inside the project so the app needs no separate install.
 * Data lives in .data/postgres (git-ignored). Skipped when DATABASE_URL points elsewhere.
 */
import { spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { env } from '../src/env.js';
import { watchLauncher } from '../src/lib/watchdog.js';

if (!env.usingEmbeddedDb) {
  console.log('DATABASE_URL is set, so the embedded database is not needed.');
  // Stay alive so the launcher doesn't read an exit as a crash and stop everything else.
  setInterval(() => {}, 1 << 30);
} else {
  await run();
}

async function run() {
  const dataDir = env.EMBEDDED_PG_DIR;
  const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
  mkdirSync(path.dirname(dataDir), { recursive: true });

  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: env.EMBEDDED_PG_PASSWORD,
    port: env.EMBEDDED_PG_PORT,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (message) => {
      const text = String(message).trim();
      if (text) console.error(text);
    },
  });

  if (fresh) {
    console.log(`Creating a new database cluster in ${dataDir}`);
    await server.initialise();
  } else {
    await stopLeftoverServer(dataDir);
  }

  try {
    await server.start();
  } catch (error) {
    console.error('Postgres failed to start. If another copy is already running, stop it first.');
    throw error;
  }

  const admin = new pg.Client({
    connectionString: `postgres://postgres:${encodeURIComponent(env.EMBEDDED_PG_PASSWORD)}@127.0.0.1:${env.EMBEDDED_PG_PORT}/postgres`,
  });
  await admin.connect();
  const { rowCount } = await admin.query(`select 1 from pg_database where datname = 'fettle'`);
  if (!rowCount) await admin.query('create database fettle');
  await admin.end();

  // Fuzzy food search needs pg_trgm; the migration would create it too, this just makes sure.
  const app = new pg.Client({
    connectionString: `postgres://postgres:${encodeURIComponent(env.EMBEDDED_PG_PASSWORD)}@127.0.0.1:${env.EMBEDDED_PG_PORT}/fettle`,
  });
  await app.connect();
  await app.query('create extension if not exists pg_trgm');
  await app.end();

  console.log(`Postgres ready on 127.0.0.1:${env.EMBEDDED_PG_PORT}`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log('Stopping Postgres...');
    // embedded-postgres stops Windows servers with `taskkill /f` (a hard kill: crash recovery on
    // the next start and a stale lock file). Ask Postgres to shut down properly first.
    const child = (server as unknown as { process?: ChildProcess }).process;
    const exited = child && child.exitCode === null ? new Promise((r) => child.once('exit', r)) : Promise.resolve();
    const result = spawnSync(await pgCtl(), ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '20'], { encoding: 'utf8' });
    if (result.status === 0) {
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      // Already stopped; stop the library from trying to kill it again on exit.
      (server as unknown as { process?: ChildProcess }).process = undefined;
    } else {
      await server.stop().catch(() => {});
    }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  watchLauncher(stop);
}

/**
 * If the app was closed abruptly (terminal killed, PC slept), our Postgres may still be running,
 * or may have died leaving its postmaster.pid lock behind. Decide by whether anything is actually
 * listening on our port: if so it's our server, so stop it cleanly; if not, the lock is stale.
 * (A stale lock whose PID Windows has since reused would otherwise block startup.)
 */
async function stopLeftoverServer(dataDir: string) {
  const lockFile = path.join(dataDir, 'postmaster.pid');
  if (!existsSync(lockFile)) return;
  if (!(await isListening(env.EMBEDDED_PG_PORT))) {
    console.log('Removing a stale database lock left by an unclean shutdown.');
    rmSync(lockFile, { force: true });
    return;
  }
  console.log('Postgres was still running from a previous session; restarting it cleanly.');
  spawnSync(await pgCtl(), ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '30'], { stdio: 'inherit' });
}

/** Path to the bundled pg_ctl for this platform. */
async function pgCtl() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const binaries = (await import(`@embedded-postgres/${platform}-${process.arch}`)) as { pg_ctl: string };
  return binaries.pg_ctl;
}

function isListening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}
