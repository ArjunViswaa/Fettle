/**
 * One-time setup against your local PostgreSQL server:
 *   - creates (or re-keys) a `fettle` login role with a random password
 *   - creates a `fettle` database owned by it, with pg_trgm for fuzzy food search
 *   - writes DATABASE_URL into .env
 *
 * It asks for the PostgreSQL superuser password once (input hidden). That password is only used
 * for this connection and is never written anywhere. Set PGPASSWORD to skip the prompt.
 *
 *   npm run db:setup                       uses localhost:5432 and the `postgres` superuser
 *   npm run db:setup -- --port 5433 --user admin
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import readline from 'node:readline';
import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const host = flag('host', 'localhost');
const port = Number(flag('port', '5432'));
const superuser = flag('user', 'postgres');
const appRole = 'fettle';
const appDb = 'fettle';

const envPath = new URL('../.env', import.meta.url);
const examplePath = new URL('../.env.example', import.meta.url);

const password = process.env.PGPASSWORD ?? (await askHidden(`Password for PostgreSQL user "${superuser}" on ${host}:${port}: `));

const admin = new pg.Client({ host, port, user: superuser, password, database: 'postgres' });
try {
  await admin.connect();
} catch (error) {
  console.error(`\nCould not connect as "${superuser}": ${error.message}`);
  console.error('Check the password (it is the one you chose when installing PostgreSQL) and that the service is running.');
  process.exit(1);
}

const rolePassword = randomBytes(24).toString('base64url');
const literal = admin.escapeLiteral(rolePassword);

const role = await admin.query('select 1 from pg_roles where rolname = $1', [appRole]);
if (role.rowCount) {
  await admin.query(`alter role ${appRole} with login password ${literal}`);
  console.log(`Role "${appRole}" already existed; gave it a fresh password.`);
} else {
  await admin.query(`create role ${appRole} with login password ${literal}`);
  console.log(`Created role "${appRole}".`);
}

const database = await admin.query('select 1 from pg_database where datname = $1', [appDb]);
if (database.rowCount) {
  console.log(`Database "${appDb}" already exists; keeping its data.`);
} else {
  await admin.query(`create database ${appDb} owner ${appRole} encoding 'UTF8' template template0`);
  console.log(`Created database "${appDb}".`);
}
await admin.end();

// Extensions need a privileged connection to the new database itself.
const inDb = new pg.Client({ host, port, user: superuser, password, database: appDb });
await inDb.connect();
await inDb.query('create extension if not exists pg_trgm');
await inDb.query(`grant all on schema public to ${appRole}`);
await inDb.end();

const url = `postgres://${appRole}:${encodeURIComponent(rolePassword)}@${host === 'localhost' ? '127.0.0.1' : host}:${port}/${appDb}`;
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8');
if (!/^BETTER_AUTH_SECRET=\S+/m.test(env)) {
  env = env.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64url')}`);
}
env = /^#?\s*DATABASE_URL=.*$/m.test(env) ? env.replace(/^#?\s*DATABASE_URL=.*$/m, `DATABASE_URL=${url}`) : `${env.trimEnd()}\nDATABASE_URL=${url}\n`;
writeFileSync(envPath, env);

console.log('\nDone. DATABASE_URL saved to .env. Start Fettle with:  npm run dev');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let prompted = false;
    // Echo the prompt itself, then swallow every keystroke so the password never shows on screen.
    rl._writeToOutput = (text) => {
      if (!prompted) {
        prompted = true;
        process.stdout.write(text);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}
