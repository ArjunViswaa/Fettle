import { eq, sql } from 'drizzle-orm';
import { ACHIEVEMENTS, longestStreak, weightTrend, type AchievementCode, type AchievementsResponse } from '@fettle/shared';
import { db, schema } from '../../db/client.js';
import { activeDays } from './insights.service.js';

const { userAchievements } = schema;

const days = (rows: Array<Record<string, unknown>>) => rows.map((r) => String(r.day));

/**
 * Works out which badges the person has earned from their data, stores any new ones and
 * returns them so the app can celebrate. Each check is a cheap aggregate on indexed columns.
 */
export async function evaluateAchievements(userId: string): Promise<AchievementsResponse> {
  const q = async (query: ReturnType<typeof sql>) => (await db.execute<Record<string, unknown>>(query)).rows;

  const [counts] = await q(sql`
    select
      (select count(*) from food_entries where user_id = ${userId}) as food_entries,
      (select count(*) from workouts where user_id = ${userId}) as workouts,
      (select count(*) from weight_entries where user_id = ${userId}) as weigh_ins,
      (select count(*) from mood_entries where user_id = ${userId}) as moods,
      (select count(*) from mindful_sessions where user_id = ${userId}) as mindful,
      (select coalesce(max(steps), 0) from step_days where user_id = ${userId}) as max_steps,
      (select coalesce(sum(steps), 0) from step_days where user_id = ${userId}) as total_steps,
      (select coalesce(max(extract(epoch from wake_at - bed_at) / 60), 0) from sleep_entries where user_id = ${userId}) as max_sleep,
      (select count(*) from fasts where user_id = ${userId} and ended_at - started_at >= interval '16 hours') as long_fasts
  `);
  const c = (key: string) => Number(counts?.[key] ?? 0);

  const [fullDays, proteinDays, waterDays, restedDays, weights, habitDays, logged] = await Promise.all([
    q(sql`
      select logged_on as day from food_entries
      where user_id = ${userId} and meal in ('breakfast', 'lunch', 'dinner')
      group by logged_on having count(distinct meal) = 3 limit 1`),
    q(sql`
      select f.logged_on as day from food_entries f join profiles p on p.user_id = f.user_id
      where f.user_id = ${userId} group by f.logged_on, p.protein_target_g having sum(f.protein_g) >= p.protein_target_g`),
    q(sql`
      select w.logged_on as day from water_entries w join profiles p on p.user_id = w.user_id
      where w.user_id = ${userId} group by w.logged_on, p.water_target_ml having sum(w.amount_ml) >= p.water_target_ml`),
    q(sql`select slept_on as day from sleep_entries where user_id = ${userId} and wake_at - bed_at >= interval '7 hours'`),
    q(sql`select measured_on as day, weight_kg from weight_entries where user_id = ${userId} order by measured_on`),
    q(sql`
      select c.habit_id, c.day from habit_checkins c join habits h on h.id = c.habit_id
      where c.user_id = ${userId} and c.count >= h.target_per_day`),
    activeDays(userId, '1900-01-01'),
  ]);

  const trend = weightTrend(weights.map((w) => ({ day: String(w.day), weightKg: Number(w.weight_kg) })));
  const firstWeight = trend[0]?.weightKg;
  const lastTrend = trend.at(-1)?.trendKg;

  const byHabit = new Map<string, string[]>();
  for (const row of habitDays) {
    const list = byHabit.get(String(row.habit_id)) ?? [];
    list.push(String(row.day));
    byHabit.set(String(row.habit_id), list);
  }
  const bestHabitRun = Math.max(0, ...[...byHabit.values()].map((d) => longestStreak(d)));
  const loggedRun = longestStreak(logged);

  const earned: Record<AchievementCode, boolean> = {
    first_bite: c('food_entries') > 0,
    full_day: fullDays.length > 0,
    protein_pro: proteinDays.length >= 5,
    hydrated: waterDays.length > 0,
    hydro_week: longestStreak(days(waterDays)) >= 7,
    ten_k: c('max_steps') >= 10_000,
    marathoner: c('total_steps') >= 250_000,
    first_workout: c('workouts') >= 1,
    ten_workouts: c('workouts') >= 10,
    fifty_workouts: c('workouts') >= 50,
    weigh_week: c('weigh_ins') >= 7,
    down_two: firstWeight !== undefined && lastTrend !== undefined && firstWeight - lastTrend >= 2,
    dream_sleeper: c('max_sleep') >= 480,
    rested_week: longestStreak(days(restedDays)) >= 7,
    streak_7: loggedRun >= 7,
    streak_30: loggedRun >= 30,
    mindful_10: c('mindful') >= 10,
    check_in_7: c('moods') >= 7,
    fast_16: c('long_fasts') >= 1,
    habit_21: bestHabitRun >= 21,
  };

  const stored = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const have = new Map(stored.map((a) => [a.code, a.unlockedAt]));
  const fresh = (Object.keys(earned) as AchievementCode[]).filter((code) => earned[code] && !have.has(code));

  if (fresh.length) {
    const inserted = await db
      .insert(userAchievements)
      .values(fresh.map((code) => ({ userId, code })))
      .onConflictDoNothing()
      .returning();
    for (const row of inserted) have.set(row.code, row.unlockedAt);
  }

  return {
    all: (Object.keys(ACHIEVEMENTS) as AchievementCode[]).map((code) => ({
      code,
      ...ACHIEVEMENTS[code],
      unlockedAt: have.get(code)?.toISOString() ?? null,
    })),
    newlyUnlocked: fresh,
  };
}
