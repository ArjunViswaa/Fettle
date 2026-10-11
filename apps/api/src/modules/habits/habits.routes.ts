import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { checkinInput, dateRange, habitInput, habitUpdate, isoDate } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';
import { listHabits } from './habits.service.js';

const { habits, habitCheckins } = schema;
const idParams = z.object({ id: z.uuid() });

export async function habitRoutes(app: App) {
  app.get('/habits', { schema: { querystring: dateRange.extend({ today: isoDate.optional() }) } }, async (request) => {
    const { from, to, today } = request.query;
    return listHabits(request.userId, from, to, today);
  });

  app.post('/habits', { schema: { body: habitInput } }, async (request, reply) => {
    const [{ next } = { next: 0 }] = await db
      .select({ next: sql<number>`coalesce(max(${habits.sortOrder}) + 1, 0)` })
      .from(habits)
      .where(eq(habits.userId, request.userId));
    const [row] = await db
      .insert(habits)
      .values({ ...request.body, sortOrder: next, userId: request.userId })
      .returning({ id: habits.id });
    return reply.code(201).send(row);
  });

  app.patch('/habits/:id', { schema: { params: idParams, body: habitUpdate } }, async (request) => {
    const { archived, ...fields } = request.body;
    const [row] = await db
      .update(habits)
      .set({ ...fields, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }) })
      .where(and(eq(habits.id, request.params.id), eq(habits.userId, request.userId)))
      .returning({ id: habits.id });
    if (!row) throw notFound('Habit');
    return row;
  });

  app.delete('/habits/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(habits)
      .where(and(eq(habits.id, request.params.id), eq(habits.userId, request.userId)))
      .returning({ id: habits.id });
    if (!row) throw notFound('Habit');
    return { ok: true };
  });

  app.put('/habits/:id/checkins/:day', { schema: { params: idParams.extend({ day: isoDate }), body: checkinInput } }, async (request) => {
    const { id, day } = request.params;
    const habit = await db.query.habits.findFirst({ where: and(eq(habits.id, id), eq(habits.userId, request.userId)) });
    if (!habit) throw notFound('Habit');
    const { count } = request.body;
    if (count === 0) {
      await db.delete(habitCheckins).where(and(eq(habitCheckins.habitId, id), eq(habitCheckins.day, day)));
    } else {
      await db
        .insert(habitCheckins)
        .values({ habitId: id, userId: request.userId, day, count })
        .onConflictDoUpdate({ target: [habitCheckins.habitId, habitCheckins.day], set: { count } });
    }
    return { ok: true };
  });
}
