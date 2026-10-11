import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { vitalInput, vitalQuery, VITAL_INFO, type Vital } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { badRequest, notFound } from '../../lib/http.js';

const { vitals } = schema;
const idParams = z.object({ id: z.uuid() });

const toVital = ({ userId: _u, createdAt: _c, measuredAt, ...rest }: typeof vitals.$inferSelect): Vital => ({
  ...rest,
  measuredAt: measuredAt.toISOString(),
});

export async function vitalRoutes(app: App) {
  app.get('/vitals', { schema: { querystring: vitalQuery } }, async (request) => {
    const { from, to, kind } = request.query;
    const rows = await db
      .select()
      .from(vitals)
      .where(
        and(
          eq(vitals.userId, request.userId),
          kind ? eq(vitals.kind, kind) : undefined,
          gte(vitals.measuredOn, from),
          lte(vitals.measuredOn, to),
        ),
      )
      .orderBy(asc(vitals.measuredAt));
    return rows.map(toVital);
  });

  app.post('/vitals', { schema: { body: vitalInput } }, async (request, reply) => {
    const input = request.body;
    const info = VITAL_INFO[input.kind];
    if (input.value < info.min || input.value > info.max) {
      throw badRequest(`${info.label} should be between ${info.min} and ${info.max} ${info.unit}`);
    }
    if (input.kind === 'blood_pressure' && !input.value2) throw badRequest('Enter both systolic and diastolic pressure');
    const [row] = await db
      .insert(vitals)
      .values({
        ...input,
        measuredAt: new Date(input.measuredAt),
        value2: input.kind === 'blood_pressure' ? input.value2 : null,
        context: input.kind === 'glucose' ? input.context : null,
        userId: request.userId,
      })
      .returning();
    return reply.code(201).send(toVital(row!));
  });

  app.delete('/vitals/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(vitals)
      .where(and(eq(vitals.id, request.params.id), eq(vitals.userId, request.userId)))
      .returning({ id: vitals.id });
    if (!row) throw notFound('Reading');
    return { ok: true };
  });
}
