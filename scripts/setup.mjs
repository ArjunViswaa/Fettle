// Creates .env with a fresh auth secret on first run, so `npm run dev` works straight after cloning.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
const examplePath = new URL('../.env.example', import.meta.url);

if (!existsSync(envPath)) {
  const secret = randomBytes(32).toString('base64url');
  const contents = readFileSync(examplePath, 'utf8').replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`);
  writeFileSync(envPath, contents);
  console.log('Created .env with a new BETTER_AUTH_SECRET.');
}

const env = readFileSync(envPath, 'utf8');
if (!/^DATABASE_URL=\S+/m.test(env)) {
  console.error('\nFettle needs a database. Run this once to create it on your local PostgreSQL:\n\n  npm run db:setup\n');
  process.exit(1);
}
