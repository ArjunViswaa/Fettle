import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { isoDate, measurementInput, weightInput, type Measurement, type WeightEntry } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';

const { weightEntries, bodyMeasurements } = schema;
const idParams = z.object({ id: z.uuid() });
const optionalRange = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export const toWeight = ({ userId: _u, createdAt: _c, ...rest }: typeof weightEntries.$inferSelect): WeightEntry => rest;
const toMeasurement = ({ userId: _u, createdAt: _c, ...rest }: typeof bodyMeasurements.$inferSelect): Measurement => rest;

export async function bodyRoutes(app: App) {
  app.get('/weights', { schema: { querystring: optionalRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(weightEntries)
      .where(
        and(
          eq(weightEntries.userId, request.userId),
          from ? gte(weightEntries.measuredOn, from) : undefined,
          to ? lte(weightEntries.measuredOn, to) : undefined,
        ),
      )
      .orderBy(asc(weightEntries.measuredOn));
    return rows.map(toWeight);
  });

  /** One weigh-in per day: logging again the same day replaces it. */
  app.put('/weights', { schema: { body: weightInput } }, async (request) => {
    const { measuredOn, ...fields } = request.body;
    const [row] = await db
      .insert(weightEntries)
      .values({ ...fields, measuredOn, userId: request.userId })
      .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.measuredOn], set: fields })
      .returning();
    return toWeight(row!);
  });

  app.delete('/weights/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(weightEntries)
      .where(and(eq(weightEntries.id, request.params.id), eq(weightEntries.userId, request.userId)))
      .returning({ id: weightEntries.id });
    if (!row) throw notFound('Weigh-in');
    return { ok: true };
  });

  app.get('/measurements', async (request) => {
    const rows = await db
      .select()
      .from(bodyMeasurements)
      .where(eq(bodyMeasurements.userId, request.userId))
      .orderBy(asc(bodyMeasurements.measuredOn));
    return rows.map(toMeasurement);
  });

  app.put('/measurements', { schema: { body: measurementInput } }, async (request) => {
    const { measuredOn, ...fields } = request.body;
    const [row] = await db
      .insert(bodyMeasurements)
      .values({ ...fields, measuredOn, userId: request.userId })
      .onConflictDoUpdate({ target: [bodyMeasurements.userId, bodyMeasurements.measuredOn], set: fields })
      .returning();
    return toMeasurement(row!);
  });

  app.delete('/measurements/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(bodyMeasurements)
      .where(and(eq(bodyMeasurements.id, request.params.id), eq(bodyMeasurements.userId, request.userId)))
      .returning({ id: bodyMeasurements.id });
    if (!row) throw notFound('Measurement');
    return { ok: true };
  });
}
