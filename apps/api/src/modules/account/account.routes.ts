import { asc, eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';

const s = schema;

/** Tables that hold a person's own health data, with their owner column, in export order. */
const EXPORTED: Array<[string, PgTable, PgColumn]> = [
  ['foodEntries', s.foodEntries, s.foodEntries.userId],
  ['waterEntries', s.waterEntries, s.waterEntries.userId],
  ['weightEntries', s.weightEntries, s.weightEntries.userId],
  ['bodyMeasurements', s.bodyMeasurements, s.bodyMeasurements.userId],
  ['stepDays', s.stepDays, s.stepDays.userId],
  ['workouts', s.workouts, s.workouts.userId],
  ['sleepEntries', s.sleepEntries, s.sleepEntries.userId],
  ['moodEntries', s.moodEntries, s.moodEntries.userId],
  ['mindfulSessions', s.mindfulSessions, s.mindfulSessions.userId],
  ['vitals', s.vitals, s.vitals.userId],
  ['habits', s.habits, s.habits.userId],
  ['habitCheckins', s.habitCheckins, s.habitCheckins.userId],
  ['medications', s.medications, s.medications.userId],
  ['medicationDoses', s.medicationDoses, s.medicationDoses.userId],
  ['fasts', s.fasts, s.fasts.userId],
  ['achievements', s.userAchievements, s.userAchievements.userId],
];

export async function accountRoutes(app: App) {
  /** Everything Fettle stores about you, as one JSON file. Nothing is left out. */
  app.get('/export', async (request, reply) => {
    const userId = request.userId;
    const [user, profile, customFoods] = await Promise.all([
      db.query.users.findFirst({ where: eq(s.users.id, userId), columns: { name: true, email: true, createdAt: true } }),
      db.query.profiles.findFirst({ where: eq(s.profiles.userId, userId) }),
      db.select().from(s.foods).where(eq(s.foods.userId, userId)).orderBy(asc(s.foods.createdAt)),
    ]);

    const tables: Record<string, unknown[]> = {};
    for (const [name, table, owner] of EXPORTED) {
      tables[name] = await db.select().from(table).where(eq(owner, userId));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    reply.header('Content-Disposition', `attachment; filename="fettle-export-${stamp}.json"`);
    return { exportedAt: new Date().toISOString(), app: 'Fettle', user, profile, customFoods, ...tables };
  });
}
