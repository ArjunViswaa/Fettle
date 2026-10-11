import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dateRange, sleepInput, sleepMinutes, type SleepEntry } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';

const { sleepEntries } = schema;
const idParams = z.object({ id: z.uuid() });

export function toSleep({ userId: _u, createdAt: _c, bedAt, wakeAt, ...rest }: typeof sleepEntries.$inferSelect): SleepEntry {
  return {
    ...rest,
    bedAt: bedAt.toISOString(),
    wakeAt: wakeAt.toISOString(),
    minutes: sleepMinutes(bedAt.toISOString(), wakeAt.toISOString()),
  };
}

export async function sleepRoutes(app: App) {
  app.get('/sleep', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(sleepEntries)
      .where(and(eq(sleepEntries.userId, request.userId), gte(sleepEntries.sleptOn, from), lte(sleepEntries.sleptOn, to)))
      .orderBy(asc(sleepEntries.sleptOn));
    return rows.map(toSleep);
  });

  /** One night per wake-up day; logging the same morning again replaces it. */
  app.put('/sleep', { schema: { body: sleepInput } }, async (request) => {
    const { sleptOn, bedAt, wakeAt, ...fields } = request.body;
    const values = { ...fields, bedAt: new Date(bedAt), wakeAt: new Date(wakeAt) };
    const [row] = await db
      .insert(sleepEntries)
      .values({ ...values, sleptOn, userId: request.userId })
      .onConflictDoUpdate({ target: [sleepEntries.userId, sleepEntries.sleptOn], set: values })
      .returning();
    return toSleep(row!);
  });

  app.delete('/sleep/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(sleepEntries)
      .where(and(eq(sleepEntries.id, request.params.id), eq(sleepEntries.userId, request.userId)))
      .returning({ id: sleepEntries.id });
    if (!row) throw notFound('Sleep entry');
    return { ok: true };
  });
}
