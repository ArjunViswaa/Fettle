import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { dayQuery, doseInput, medicationInput, medicationUpdate, type Medication } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';
import { dosesForDay } from './meds.service.js';

const { medications, medicationDoses } = schema;
const idParams = z.object({ id: z.uuid() });

const toMedication = ({ userId: _u, createdAt: _c, archivedAt, ...rest }: typeof medications.$inferSelect): Medication => ({
  ...rest,
  archived: archivedAt !== null,
});

export async function medicationRoutes(app: App) {
  app.get('/medications', async (request) => {
    const rows = await db
      .select()
      .from(medications)
      .where(eq(medications.userId, request.userId))
      .orderBy(asc(medications.createdAt));
    return rows.map(toMedication);
  });

  app.get('/medications/doses', { schema: { querystring: dayQuery } }, async (request) => dosesForDay(request.userId, request.query.date));

  app.post('/medications', { schema: { body: medicationInput } }, async (request, reply) => {
    const input = request.body;
    const [row] = await db
      .insert(medications)
      .values({ ...input, times: [...new Set(input.times)].sort(), userId: request.userId })
      .returning();
    return reply.code(201).send(toMedication(row!));
  });

  app.patch('/medications/:id', { schema: { params: idParams, body: medicationUpdate } }, async (request) => {
    const { archived, times, ...fields } = request.body;
    const [row] = await db
      .update(medications)
      .set({
        ...fields,
        ...(times ? { times: [...new Set(times)].sort() } : {}),
        ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      })
      .where(and(eq(medications.id, request.params.id), eq(medications.userId, request.userId)))
      .returning();
    if (!row) throw notFound('Medication');
    return toMedication(row);
  });

  app.delete('/medications/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(medications)
      .where(and(eq(medications.id, request.params.id), eq(medications.userId, request.userId)))
      .returning({ id: medications.id });
    if (!row) throw notFound('Medication');
    return { ok: true };
  });

  app.put('/medications/:id/doses', { schema: { params: idParams, body: doseInput } }, async (request) => {
    const med = await db.query.medications.findFirst({
      where: and(eq(medications.id, request.params.id), eq(medications.userId, request.userId)),
    });
    if (!med) throw notFound('Medication');
    const { day, time, status } = request.body;
    if (status === 'pending') {
      await db
        .delete(medicationDoses)
        .where(and(eq(medicationDoses.medicationId, med.id), eq(medicationDoses.day, day), eq(medicationDoses.time, time)));
    } else {
      const takenAt = status === 'taken' ? new Date() : null;
      await db
        .insert(medicationDoses)
        .values({ medicationId: med.id, userId: request.userId, day, time, status, takenAt })
        .onConflictDoUpdate({
          target: [medicationDoses.medicationId, medicationDoses.day, medicationDoses.time],
          set: { status, takenAt },
        });
    }
    return { ok: true };
  });
}
