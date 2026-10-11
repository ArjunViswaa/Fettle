import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { dateRange, stepsInput, workoutCalories, workoutInput, workoutUpdate, type StepDay, type Workout } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { notFound } from '../../lib/http.js';
import { currentWeightKg } from '../profile/profile.service.js';

const { stepDays, workouts } = schema;
const idParams = z.object({ id: z.uuid() });

const toSteps = ({ userId: _u, updatedAt: _t, ...rest }: typeof stepDays.$inferSelect): StepDay => rest;
export const toWorkout = ({ userId: _u, createdAt, ...rest }: typeof workouts.$inferSelect): Workout => ({
  ...rest,
  createdAt: createdAt.toISOString(),
});

export async function activityRoutes(app: App) {
  app.get('/steps', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(stepDays)
      .where(and(eq(stepDays.userId, request.userId), gte(stepDays.day, from), lte(stepDays.day, to)))
      .orderBy(asc(stepDays.day));
    return rows.map(toSteps);
  });

  /** Steps are a daily total (what your phone or watch shows), so this replaces the day's value. */
  app.put('/steps', { schema: { body: stepsInput } }, async (request) => {
    const { day, ...fields } = request.body;
    const [row] = await db
      .insert(stepDays)
      .values({ ...fields, day, userId: request.userId })
      .onConflictDoUpdate({ target: [stepDays.userId, stepDays.day], set: { ...fields, updatedAt: new Date() } })
      .returning();
    return toSteps(row!);
  });

  app.get('/workouts', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    const rows = await db
      .select()
      .from(workouts)
      .where(and(eq(workouts.userId, request.userId), gte(workouts.performedOn, from), lte(workouts.performedOn, to)))
      .orderBy(desc(workouts.performedOn), desc(workouts.createdAt));
    return rows.map(toWorkout);
  });

  app.post('/workouts', { schema: { body: workoutInput } }, async (request, reply) => {
    const input = request.body;
    const caloriesBurned =
      input.caloriesBurned ?? workoutCalories(input.type, input.intensity, input.durationMin, await currentWeightKg(request.userId));
    const [row] = await db
      .insert(workouts)
      .values({ ...input, caloriesBurned, userId: request.userId })
      .returning();
    return reply.code(201).send(toWorkout(row!));
  });

  app.patch('/workouts/:id', { schema: { params: idParams, body: workoutUpdate } }, async (request) => {
    const existing = await db.query.workouts.findFirst({
      where: and(eq(workouts.id, request.params.id), eq(workouts.userId, request.userId)),
    });
    if (!existing) throw notFound('Workout');
    const next = { ...existing, ...request.body };
    // Re-estimate unless the user typed a number (e.g. from their watch).
    const caloriesBurned =
      request.body.caloriesBurned ?? workoutCalories(next.type, next.intensity, next.durationMin, await currentWeightKg(request.userId));
    const [row] = await db
      .update(workouts)
      .set({ ...request.body, caloriesBurned })
      .where(eq(workouts.id, existing.id))
      .returning();
    return toWorkout(row!);
  });

  app.delete('/workouts/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(workouts)
      .where(and(eq(workouts.id, request.params.id), eq(workouts.userId, request.userId)))
      .returning({ id: workouts.id });
    if (!row) throw notFound('Workout');
    return { ok: true };
  });
}
