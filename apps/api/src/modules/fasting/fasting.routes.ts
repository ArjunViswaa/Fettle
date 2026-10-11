import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { endFastInput, startFastInput, type Fast } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { badRequest, conflict, notFound } from '../../lib/http.js';

const { fasts } = schema;
const idParams = z.object({ id: z.uuid() });

export const toFast = (row: typeof fasts.$inferSelect): Fast => ({
  id: row.id,
  startedAt: row.startedAt.toISOString(),
  endedAt: row.endedAt?.toISOString() ?? null,
  targetHours: row.targetHours,
});

export async function fastingRoutes(app: App) {
  app.get('/fasts', async (request) => {
    const rows = await db
      .select()
      .from(fasts)
      .where(eq(fasts.userId, request.userId))
      .orderBy(desc(fasts.startedAt))
      .limit(60);
    const all = rows.map(toFast);
    return { active: all.find((f) => !f.endedAt) ?? null, history: all.filter((f) => f.endedAt) };
  });

  app.post('/fasts', { schema: { body: startFastInput } }, async (request, reply) => {
    const startedAt = request.body.startedAt ? new Date(request.body.startedAt) : new Date();
    if (startedAt.getTime() > Date.now() + 60_000) throw badRequest('A fast cannot start in the future');
    const active = await db.query.fasts.findFirst({ where: and(eq(fasts.userId, request.userId), isNull(fasts.endedAt)) });
    if (active) throw conflict('You already have a fast running');
    const [row] = await db
      .insert(fasts)
      .values({ userId: request.userId, startedAt, targetHours: request.body.targetHours })
      .returning();
    return reply.code(201).send(toFast(row!));
  });

  app.post('/fasts/:id/end', { schema: { params: idParams, body: endFastInput } }, async (request) => {
    const fast = await db.query.fasts.findFirst({
      where: and(eq(fasts.id, request.params.id), eq(fasts.userId, request.userId), isNull(fasts.endedAt)),
    });
    if (!fast) throw notFound('Running fast');
    const endedAt = request.body.endedAt ? new Date(request.body.endedAt) : new Date();
    if (endedAt <= fast.startedAt) throw badRequest('A fast has to end after it starts');
    const [row] = await db.update(fasts).set({ endedAt }).where(eq(fasts.id, fast.id)).returning();
    return toFast(row!);
  });

  app.delete('/fasts/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(fasts)
      .where(and(eq(fasts.id, request.params.id), eq(fasts.userId, request.userId)))
      .returning({ id: fasts.id });
    if (!row) throw notFound('Fast');
    return { ok: true };
  });
}
