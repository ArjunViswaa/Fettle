import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'error',
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`, 'not_found');
export const badRequest = (message: string) => new HttpError(400, message, 'bad_request');
export const conflict = (message: string) => new HttpError(409, message, 'conflict');

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

/** preHandler for every /api/v1 route: resolves the session or rejects with 401. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    return reply.code(401).send({ error: 'unauthorized', message: 'Please sign in' });
  }
  request.userId = session.user.id;
}
