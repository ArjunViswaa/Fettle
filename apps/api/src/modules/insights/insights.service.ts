import { sql } from 'drizzle-orm';
import { addDays, daysBetween, stepCalories, type DailyPoint } from '@fettle/shared';
import { db } from '../../db/client.js';
import { badRequest } from '../../lib/http.js';

const MAX_RANGE_DAYS = 800;

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** One row per day with every metric we chart, nulls where nothing was logged. */
export async function dailySeries(userId: string, from: string, to: string, weightKg: number): Promise<DailyPoint[]> {
  if (to < from) throw badRequest('The range ends before it starts');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) throw badRequest(`Ranges are limited to ${MAX_RANGE_DAYS} days`);

  const { rows } = await db.execute<Record<string, unknown>>(sql`
    with days as (
      select d::date as day from generate_series(${from}::date, ${to}::date, interval '1 day') d
    ),
    food as (
      select logged_on as day, sum(calories) as calories, sum(protein_g) as protein, sum(carbs_g) as carbs, sum(fat_g) as fat
      from food_entries where user_id = ${userId} and logged_on between ${from} and ${to} group by 1
    ),
    water as (
      select logged_on as day, sum(amount_ml) as ml
      from water_entries where user_id = ${userId} and logged_on between ${from} and ${to} group by 1
    ),
    steps as (
      select day, steps, active_minutes from step_days where user_id = ${userId} and day between ${from} and ${to}
    ),
    workouts as (
      select performed_on as day, sum(duration_min) as minutes, sum(calories_burned) as kcal
      from workouts where user_id = ${userId} and performed_on between ${from} and ${to} group by 1
    ),
    sleep as (
      select slept_on as day, extract(epoch from wake_at - bed_at) / 60 as minutes, quality
      from sleep_entries where user_id = ${userId} and slept_on between ${from} and ${to}
    ),
    mood as (
      select distinct on (logged_on) logged_on as day, mood, energy, stress
      from mood_entries where user_id = ${userId} and logged_on between ${from} and ${to}
      order by logged_on, logged_at desc
    ),
    weight as (
      select measured_on as day, weight_kg from weight_entries where user_id = ${userId} and measured_on between ${from} and ${to}
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      food.calories, food.protein, food.carbs, food.fat,
      water.ml as water,
      steps.steps, steps.active_minutes,
      workouts.minutes as workout_minutes, workouts.kcal as workout_kcal,
      sleep.minutes as sleep_minutes, sleep.quality as sleep_quality,
      mood.mood, mood.energy, mood.stress,
      weight.weight_kg
    from days
    left join food on food.day = days.day
    left join water on water.day = days.day
    left join steps on steps.day = days.day
    left join workouts on workouts.day = days.day
    left join sleep on sleep.day = days.day
    left join mood on mood.day = days.day
    left join weight on weight.day = days.day
    order by days.day
  `);

  return rows.map((row) => {
    const steps = n(row.steps);
    const workoutKcal = n(row.workout_kcal);
    const workoutMinutes = n(row.workout_minutes);
    const active = n(row.active_minutes);
    return {
      day: String(row.day),
      calories: r1(n(row.calories)),
      proteinG: r1(n(row.protein)),
      carbsG: r1(n(row.carbs)),
      fatG: r1(n(row.fat)),
      waterMl: n(row.water),
      steps,
      activeMinutes: active === null && workoutMinutes === null ? null : Math.max(active ?? 0, workoutMinutes ?? 0),
      workoutMinutes,
      burned: steps === null && workoutKcal === null ? null : (workoutKcal ?? 0) + stepCalories(steps ?? 0, weightKg),
      sleepMinutes: r1(n(row.sleep_minutes)),
      sleepQuality: n(row.sleep_quality),
      mood: n(row.mood),
      energy: n(row.energy),
      stress: n(row.stress),
      weightKg: n(row.weight_kg),
    };
  });
}

/** Days on which anything at all was logged, for the "keep showing up" streak. */
export async function activeDays(userId: string, since: string): Promise<string[]> {
  const { rows } = await db.execute<{ day: string }>(sql`
    select distinct to_char(day, 'YYYY-MM-DD') as day from (
      select logged_on as day from food_entries where user_id = ${userId} and logged_on >= ${since}
      union all select logged_on from water_entries where user_id = ${userId} and logged_on >= ${since}
      union all select day from step_days where user_id = ${userId} and day >= ${since}
      union all select performed_on from workouts where user_id = ${userId} and performed_on >= ${since}
      union all select measured_on from weight_entries where user_id = ${userId} and measured_on >= ${since}
      union all select slept_on from sleep_entries where user_id = ${userId} and slept_on >= ${since}
      union all select logged_on from mood_entries where user_id = ${userId} and logged_on >= ${since}
      union all select day from habit_checkins where user_id = ${userId} and day >= ${since}
    ) logged
  `);
  return rows.map((r) => r.day);
}

export const streakWindowStart = (today: string) => addDays(today, -400);
