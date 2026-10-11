import { hash, verify } from '@node-rs/argon2';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db, schema } from './db/client.js';
import { env } from './env.js';
import { seedStarterHabits } from './modules/habits/habits.service.js';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const argon2Options = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Header the Fastify bridge fills with the real socket address (see app.ts). */
export const CLIENT_IP_HEADER = 'x-fettle-client-ip';

export const auth = betterAuth({
  appName: 'Fettle',
  baseURL: env.APP_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL, `http://localhost:${env.API_PORT}`, `http://127.0.0.1:${env.API_PORT}`],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.authAccounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: (password) => hash(password, argon2Options),
      verify: ({ hash: stored, password }) => verify(stored, password),
    },
  },
  user: {
    // Health data belongs to the person: they can delete everything in one go (all tables cascade).
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, sliding
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 60, max: 3 },
    },
  },
  advanced: {
    database: { generateId: () => crypto.randomUUID() },
    cookiePrefix: 'fettle',
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!env.ALLOW_SIGNUP) throw new APIError('FORBIDDEN', { message: 'Sign-ups are closed on this Fettle server.' });
          return { data: user };
        },
        after: async (user) => {
          await seedStarterHabits(user.id);
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
