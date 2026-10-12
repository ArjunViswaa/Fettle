/**
 * What the desktop shortcut runs. Opens Fettle in the browser, starting it first if needed:
 * the built-in database plus the API serving the built web app on one port.
 *
 * The console window it runs in is the server. Closing that window stops Fettle cleanly.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const node = process.execPath;
spawnSync(node, ['scripts/setup.mjs'], { stdio: 'inherit' });

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const port = Number(env.match(/^API_PORT=(\d+)/m)?.[1] ?? 4100);
const url = `http://localhost:${port}`;

async function healthy() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function openBrowser(target = url) {
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', target], { stdio: 'ignore', detached: true }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { stdio: 'ignore', detached: true }).unref();
}

if (await healthy()) {
  // A running dev server (`npm run dev`) has the API here but serves the pages from Vite instead.
  const page = await fetch(url, { signal: AbortSignal.timeout(1500) }).catch(() => null);
  const target = page?.ok ? url : 'http://localhost:5174';
  console.log(`Fettle is already running. Opening ${target}`);
  openBrowser(target);
  process.exit(0);
}

console.log('Starting Fettle... (keep this window open; close it to stop Fettle)\n');
const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('\nBuilding the web app failed. Press Enter to close.');
  process.stdin.once('data', () => process.exit(1));
} else {
  const server = spawn(node, ['scripts/run.mjs', 'start'], { stdio: 'inherit' });
  server.on('exit', (code) => process.exit(code ?? 0));

  // The first start creates the database, which can take a little while.
  const deadline = Date.now() + 120_000;
  while (!(await healthy())) {
    if (Date.now() > deadline) {
      console.error('\nFettle did not come up within two minutes. Check the messages above.');
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (await healthy()) {
    console.log(`\nFettle is ready at ${url}`);
    openBrowser();
  }
}
