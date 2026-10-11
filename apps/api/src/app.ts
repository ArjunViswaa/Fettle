import { existsSync } from 'node:fs';
import path from 'node:path';
import fastifyCompress from '@fastify/compress';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type RawReplyDefaultExpression,
  type RawRequestDefaultExpression,
  type RawServerDefault,
} from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { auth, CLIENT_IP_HEADER } from './auth.js';
import { pool } from './db/client.js';
import { env, repoRoot } from './env.js';
import { HttpError, requireUser } from './lib/http.js';
import { accountRoutes } from './modules/account/account.routes.js';
import { activityRoutes } from './modules/activity/activity.routes.js';
import { bodyRoutes } from './modules/body/body.routes.js';
import { fastingRoutes } from './modules/fasting/fasting.routes.js';
import { habitRoutes } from './modules/habits/habits.routes.js';
import { insightRoutes } from './modules/insights/insights.routes.js';
import { medicationRoutes } from './modules/meds/meds.routes.js';
import { mindRoutes } from './modules/mind/mind.routes.js';
import { nutritionRoutes } from './modules/nutrition/nutrition.routes.js';
import { profileRoutes } from './modules/profile/profile.routes.js';
import { sleepRoutes } from './modules/sleep/sleep.routes.js';
import { todayRoutes } from './modules/today/today.routes.js';
import { vitalRoutes } from './modules/vitals/vitals.routes.js';

export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'warn'),
      // Health data never goes to logs: no bodies, no cookies.
      redact: ['req.headers.cookie', 'req.headers.authorization'],
    },
    trustProxy: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifyCompress, { threshold: 1024 });

  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'DENY');
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });

  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: 'validation',
        message: error.validation[0]?.message ?? 'Some fields are invalid',
        issues: error.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'validation', message: error.issues[0]?.message ?? 'Invalid input' });
    }
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.code(status).send({ error: 'request', message: (error as Error).message });
    }
    request.log.error(error);
    return reply.code(500).send({ error: 'internal', message: 'Something went wrong' });
  });

  // Better Auth speaks Fetch Request/Response; bridge Fastify to it.
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.append(key, Array.isArray(value) ? value.join(', ') : String(value));
      }
      // The socket address, for per-client login rate limits. Set (not appended) so a client can't spoof it.
      headers.set(CLIENT_IP_HEADER, request.ip);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.body == null ? undefined : JSON.stringify(request.body),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie' && key !== 'content-length') reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });

  // Every feature lives in its own module behind the session check; adding one is one line here.
  await app.register(
    async (api) => {
      api.addHook('preHandler', requireUser);
      for (const routes of [
        accountRoutes,
        profileRoutes,
        todayRoutes,
        nutritionRoutes,
        bodyRoutes,
        activityRoutes,
        sleepRoutes,
        mindRoutes,
        vitalRoutes,
        habitRoutes,
        medicationRoutes,
        fastingRoutes,
        insightRoutes,
      ]) {
        await api.register(routes);
      }
    },
    { prefix: '/api/v1' },
  );

  app.get('/api/health', async () => {
    await pool.query('select 1');
    return { ok: true };
  });

  app.get('/api/status', async () => ({ signupOpen: env.ALLOW_SIGNUP }));

  // In production the API also serves the built web app, so one process is the whole server.
  const webDist = path.join(repoRoot, 'apps', 'web', 'dist');
  if (env.NODE_ENV === 'production' && existsSync(path.join(webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: webDist, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found', message: 'No such endpoint' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
