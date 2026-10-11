import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dateRange, mindfulInput, moodInput, type MindfulSession, type MoodEntry } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';

const { moodEntries, mindfulSessions } = schema;
const idParams = z.object({ id: z.uuid() });

export const toMood = ({ userId: _u, loggedAt, ...rest }: typeof moodEntries.$inferSelect): MoodEntry => ({
  ...rest,
  loggedAt: loggedAt.toISOString(),
});
const toMindful = ({ userId: _u, createdAt, ...rest }: typeof mindfulSessions.$inferSelect): MindfulSession => ({
  ...rest,
  createdAt: createdAt.toISOString(),
});

export async function mindRoutes(app: App) {
  app.get('/moods', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(moodEntries)
      .where(and(eq(moodEntries.userId, request.userId), gte(moodEntries.loggedOn, from), lte(moodEntries.loggedOn, to)))
      .orderBy(asc(moodEntries.loggedAt));
    return rows.map(toMood);
  });

  // Several check-ins a day are fine; daily views use the latest one.
  app.post('/moods', { schema: { body: moodInput } }, async (request, reply) => {
    const [row] = await db
      .insert(moodEntries)
      .values({ ...request.body, userId: request.userId })
      .returning();
    return reply.code(201).send(toMood(row!));
  });

  app.delete('/moods/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(moodEntries)
      .where(and(eq(moodEntries.id, request.params.id), eq(moodEntries.userId, request.userId)))
      .returning({ id: moodEntries.id });
    if (!row) throw notFound('Check-in');
    return { ok: true };
  });

  app.get('/mindful', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(mindfulSessions)
      .where(and(eq(mindfulSessions.userId, request.userId), gte(mindfulSessions.loggedOn, from), lte(mindfulSessions.loggedOn, to)))
      .orderBy(asc(mindfulSessions.createdAt));
    return rows.map(toMindful);
  });

  app.post('/mindful', { schema: { body: mindfulInput } }, async (request, reply) => {
    const [row] = await db
      .insert(mindfulSessions)
      .values({ ...request.body, userId: request.userId })
      .returning();
    return reply.code(201).send(toMindful(row!));
  });
}
