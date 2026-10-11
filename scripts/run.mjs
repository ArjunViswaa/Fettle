/**
 * Starts Fettle's processes together with prefixed, coloured output.
 *
 *   node scripts/run.mjs dev     API (watch) + web (Vite)
 *   node scripts/run.mjs api     API (watch)
 *   node scripts/run.mjs start   API serving the built web app
 *
 * Why not `concurrently`: on Windows, force-killing the top-level process leaves its children
 * running and holding ports. This launcher writes a heartbeat file every 2s; each child watches it
 * (apps/api/src/lib/watchdog.ts and the Vite plugin) and shuts itself down once it stops.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heartbeat = path.join(root, '.data', 'launcher.heartbeat');

const TASKS = {
  api: { cmd: 'npm run dev -w @fettle/api', color: 36, env: { FETTLE_STOP_PARENT: '1' } },
  'api-prod': { cmd: 'npm run start -w @fettle/api', color: 36, label: 'api' },
  web: { cmd: 'npm run dev -w @fettle/web', color: 35 },
};
const MODES = { dev: ['api', 'web'], api: ['api'], start: ['api-prod'] };

const mode = process.argv[2] ?? 'dev';
const names = MODES[mode];
if (!names) {
  console.error(`Unknown mode "${mode}". Use: ${Object.keys(MODES).join(', ')}`);
  process.exit(1);
}

mkdirSync(path.dirname(heartbeat), { recursive: true });
const beat = () => writeFileSync(heartbeat, String(Date.now()));
beat();
const beatTimer = setInterval(beat, 2000);

const width = Math.max(...names.map((n) => (TASKS[n].label ?? n).length));
const children = new Map();
let stopping = false;

for (const name of names) {
  const task = TASKS[name];
  const label = `\x1b[${task.color}m[${(task.label ?? name).padEnd(width)}]\x1b[0m `;
  const child = spawn(task.cmd, {
    cwd: root,
    shell: true,
    env: { ...process.env, ...task.env, FETTLE_HEARTBEAT: heartbeat, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.set(name, child);
  for (const stream of [child.stdout, child.stderr]) {
    let partial = '';
    stream.on('data', (chunk) => {
      const lines = (partial + chunk.toString()).split(/\r?\n/);
      partial = lines.pop() ?? '';
      for (const line of lines) process.stdout.write(label + line + '\n');
    });
  }
  child.on('exit', (code) => {
    children.delete(name);
    if (!stopping) {
      console.log(`${label}exited with code ${code}; stopping the others.`);
      stop(code ?? 1);
    } else if (children.size === 0) {
      process.exit(exitCode);
    }
  });
}

let exitCode = 0;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  clearInterval(beatTimer);
  rmSync(heartbeat, { force: true });
  if (children.size === 0) process.exit(exitCode);
  // Last resort if something ignores the watchdog.
  setTimeout(() => {
    for (const child of children.values()) child.kill();
    process.exit(exitCode);
  }, 15_000).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('SIGHUP', () => stop(0));
