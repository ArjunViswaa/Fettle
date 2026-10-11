import { and, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import { currentStreak, dayQuery, fettleScore, MEALS, stepCalories, type DaySummary, type Meal, type Nutrients } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { toWorkout } from '../activity/activity.routes.js';
import { toWeight } from '../body/body.routes.js';
import { toFast } from '../fasting/fasting.routes.js';
import { listHabits } from '../habits/habits.service.js';
import { activeDays, streakWindowStart } from '../insights/insights.service.js';
import { dosesForDay } from '../meds/meds.service.js';
import { toMood } from '../mind/mind.routes.js';
import { requireProfile } from '../profile/profile.service.js';
import { toSleep } from '../sleep/sleep.routes.js';

const { foodEntries, waterEntries, stepDays, workouts, sleepEntries, moodEntries, mindfulSessions, weightEntries, fasts } = schema;

const empty = (): Nutrients => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 });
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Everything the Today screen needs in one round trip. The day comes from the browser,
 * so "today" is always the user's own calendar day.
 */
export async function todayRoutes(app: App) {
  app.get('/today', { schema: { querystring: dayQuery } }, async (request): Promise<DaySummary> => {
    const userId = request.userId;
    const day = request.query.date;
    const profile = await requireProfile(userId);

    const [entries, water, steps, dayWorkouts, sleep, mood, mindful, weights, habits, doses, activeFast, logged] = await Promise.all([
      db.select().from(foodEntries).where(and(eq(foodEntries.userId, userId), eq(foodEntries.loggedOn, day))),
      db
        .select({ total: sql<number>`coalesce(sum(${waterEntries.amountMl}), 0)` })
        .from(waterEntries)
        .where(and(eq(waterEntries.userId, userId), eq(waterEntries.loggedOn, day))),
      db.query.stepDays.findFirst({ where: and(eq(stepDays.userId, userId), eq(stepDays.day, day)) }),
      db.select().from(workouts).where(and(eq(workouts.userId, userId), eq(workouts.performedOn, day))),
      db.query.sleepEntries.findFirst({ where: and(eq(sleepEntries.userId, userId), eq(sleepEntries.sleptOn, day)) }),
      db.query.moodEntries.findFirst({
        where: and(eq(moodEntries.userId, userId), eq(moodEntries.loggedOn, day)),
        orderBy: desc(moodEntries.loggedAt),
      }),
      db
        .select({ seconds: sql<number>`coalesce(sum(${mindfulSessions.durationSec}), 0)` })
        .from(mindfulSessions)
        .where(and(eq(mindfulSessions.userId, userId), eq(mindfulSessions.loggedOn, day))),
      db
        .select()
        .from(weightEntries)
        .where(and(eq(weightEntries.userId, userId), lte(weightEntries.measuredOn, day)))
        .orderBy(desc(weightEntries.measuredOn))
        .limit(2),
      listHabits(userId, day, day, day),
      dosesForDay(userId, day),
      db.query.fasts.findFirst({ where: and(eq(fasts.userId, userId), isNull(fasts.endedAt)) }),
      activeDays(userId, streakWindowStart(day)),
    ]);

    const byMeal = Object.fromEntries(MEALS.map((m) => [m, { ...empty(), count: 0 }])) as DaySummary['nutrition']['byMeal'];
    const totals = empty();
    for (const e of entries) {
      const meal = byMeal[e.meal as Meal];
      meal.count++;
      for (const key of Object.keys(totals) as Array<keyof Nutrients>) {
        meal[key] += e[key];
        totals[key] += e[key];
      }
    }
    for (const key of Object.keys(totals) as Array<keyof Nutrients>) {
      totals[key] = round1(totals[key]);
      for (const m of MEALS) byMeal[m][key] = round1(byMeal[m][key]);
    }

    const weightKg = weights[0]?.weightKg ?? profile.latestWeightKg ?? 70;
    const workoutBurn = dayWorkouts.reduce((a, w) => a + w.caloriesBurned, 0);
    const workoutMinutes = dayWorkouts.reduce((a, w) => a + w.durationMin, 0);
    const stepBurn = steps ? stepCalories(steps.steps, weightKg) : 0;
    const activeMinutes = Math.max(steps?.activeMinutes ?? 0, workoutMinutes);
    const sleepEntry = sleep ? toSleep(sleep) : null;
    const waterMl = water[0]?.total ?? 0;

    const score = fettleScore({
      caloriesEaten: totals.calories,
      calorieTarget: profile.calorieTarget,
      proteinRatio: totals.proteinG / Math.max(1, profile.proteinTargetG),
      waterRatio: waterMl / profile.waterTargetMl,
      stepsRatio: (steps?.steps ?? 0) / profile.stepTarget,
      activeRatio: activeMinutes / profile.activeMinutesTarget,
      sleepRatio: sleepEntry ? sleepEntry.minutes / profile.sleepTargetMinutes : null,
      mood: mood?.mood ?? null,
    });

    // Counted back from the requested day, so browsing history shows the streak as it was then.
    const streak = currentStreak(logged.filter((d) => d <= day), day);

    return {
      date: day,
      nutrition: { ...totals, byMeal },
      waterMl,
      steps: steps ? { day: steps.day, steps: steps.steps, activeMinutes: steps.activeMinutes, floors: steps.floors } : null,
      workouts: dayWorkouts.map(toWorkout),
      burned: { workouts: workoutBurn, steps: stepBurn, total: workoutBurn + stepBurn },
      activeMinutes,
      sleep: sleepEntry,
      mood: mood ? toMood(mood) : null,
      mindfulMinutes: Math.round((mindful[0]?.seconds ?? 0) / 60),
      weight: {
        latest: weights[0] ? toWeight(weights[0]) : null,
        previous: weights[1] ? toWeight(weights[1]) : null,
      },
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        targetPerDay: h.targetPerDay,
        count: h.checkins[day] ?? 0,
        streak: h.currentStreak,
      })),
      doses,
      activeFast: activeFast ? toFast(activeFast) : null,
      streak,
      score,
    };
  });
}
