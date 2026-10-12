// Makes sure .env exists and has its secrets, so `npm run dev` works straight after cloning.
// Generated values are only added when missing; anything already in .env is kept as it is.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
const examplePath = new URL('../.env.example', import.meta.url);

let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(examplePath, 'utf8');
const before = env;

const ensure = (key, value) => {
  const line = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (new RegExp(`^${key}=\\S+`, 'm').test(env)) return;
  env = line.test(env) ? env.replace(line, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
  console.log(`Added ${key} to .env`);
};

ensure('BETTER_AUTH_SECRET', randomBytes(32).toString('base64url'));
// Hex keeps it easy to paste into database tools like DBeaver.
ensure('EMBEDDED_PG_PASSWORD', randomBytes(12).toString('hex'));

if (env !== before || !existsSync(envPath)) writeFileSync(envPath, env);
