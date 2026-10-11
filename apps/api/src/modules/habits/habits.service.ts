import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { currentStreak, longestStreak, todayISO, type Habit } from '@fettle/shared';
import { db, schema } from '../../db/client.js';

const { habits, habitCheckins } = schema;

const STARTERS = [
  { name: 'Take vitamins', emoji: '💊', color: '#7c6cf2' },
  { name: 'Stretch for 10 minutes', emoji: '🙆', color: '#2fbf9b' },
  { name: 'No screens before bed', emoji: '📵', color: '#3ba7f0' },
];

/** A few gentle examples so the habits page isn't empty on day one. Easy to archive. */
export async function seedStarterHabits(userId: string) {
  await db.insert(habits).values(STARTERS.map((h, i) => ({ ...h, userId, sortOrder: i })));
}

export async function listHabits(userId: string, from: string, to: string, today = todayISO()): Promise<Habit[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.archivedAt)))
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt));
  if (!rows.length) return [];

  const [inRange, completed] = await Promise.all([
    db
      .select({ habitId: habitCheckins.habitId, day: habitCheckins.day, count: habitCheckins.count })
      .from(habitCheckins)
      .where(and(eq(habitCheckins.userId, userId), gte(habitCheckins.day, from), lte(habitCheckins.day, to))),
    // Days where the daily target was met, across all time, for streaks.
    db
      .select({ habitId: habitCheckins.habitId, day: habitCheckins.day })
      .from(habitCheckins)
      .innerJoin(habits, eq(habits.id, habitCheckins.habitId))
      .where(and(eq(habitCheckins.userId, userId), sql`${habitCheckins.count} >= ${habits.targetPerDay}`)),
  ]);

  return rows.map((h) => {
    const checkins: Record<string, number> = {};
    for (const c of inRange) if (c.habitId === h.id) checkins[c.day] = c.count;
    const doneDays = completed.filter((c) => c.habitId === h.id).map((c) => c.day);
    return {
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      targetPerDay: h.targetPerDay,
      sortOrder: h.sortOrder,
      createdAt: h.createdAt.toISOString(),
      checkins,
      currentStreak: currentStreak(doneDays, today),
      longestStreak: longestStreak(doneDays),
    };
  });
}
