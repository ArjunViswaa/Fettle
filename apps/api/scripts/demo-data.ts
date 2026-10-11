/**
 * Fills an existing, onboarded account with ~60 days of realistic sample data, so every chart
 * has something to show. For trying Fettle out; don't run it on the account you really use.
 *
 *   npm run db:demo -- --email you@example.com [--days 60] [--force]
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { addDays, MEALS, todayISO, workoutCalories, type Intensity, type WorkoutType } from '@fettle/shared';
import { db, pool, schema } from '../src/db/client.js';
import { migrateDatabase } from '../src/db/migrate.js';
import { seedFoodCatalogue } from '../src/db/seed-foods.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = flag('email');
const days = Number(flag('days') ?? 60);
if (!email) {
  console.error('Usage: npm run db:demo -- --email you@example.com [--days 60] [--force]');
  process.exit(1);
}

await migrateDatabase();
await seedFoodCatalogue();

const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
if (!user) throw new Error(`No account with email ${email}. Sign up in the app first.`);
const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, user.id) });
if (!profile) throw new Error('Finish onboarding in the app first, so there are targets to aim at.');

const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)` }).from(schema.foodEntries).where(eq(schema.foodEntries.userId, user.id));
if (n > 0 && !args.includes('--force')) {
  console.error('This account already has food entries. Pass --force to add sample data anyway.');
  process.exit(1);
}

// Deterministic randomness so reruns look the same.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number) => rand() < p;

const catalogue = await db.select().from(schema.foods).where(and(isNull(schema.foods.userId), isNull(schema.foods.deletedAt)));
const byName = new Map(catalogue.map((f) => [f.name, f]));
const MENU: Record<string, string[][]> = {
  breakfast: [['Idli', 'Sambar'], ['Poha', 'Masala chai (milk & sugar)'], ['Oatmeal, cooked with water', 'Banana'], ['Omelette (2 eggs)', 'Whole wheat bread', 'Black coffee'], ['Masala dosa'], ['Greek yogurt, nonfat', 'Blueberries', 'Granola']],
  lunch: [['White rice, cooked', 'Dal (toor), cooked', 'Mixed veg curry'], ['Roti / chapati', 'Roti / chapati', 'Palak paneer', 'Curd / plain yogurt'], ['Chicken biryani'], ['Grilled chicken salad'], ['Rajma curry', 'White rice, cooked'], ['Veg thali']],
  dinner: [['Roti / chapati', 'Roti / chapati', 'Chicken curry', 'Green salad'], ['Brown rice, cooked', 'Fish curry'], ['Khichdi', 'Curd / plain yogurt'], ['Paneer butter masala', 'Naan'], ['Spaghetti bolognese'], ['Chole (chickpea curry)', 'Roti / chapati']],
  snack: [['Almonds'], ['Apple'], ['Masala chai (milk & sugar)', 'Digestive biscuits'], ['Protein bar'], ['Samosa'], ['Banana', 'Peanut butter'], ['Dark chocolate 70%']],
};

const today = todayISO();
const start = addDays(today, -(days - 1));
let weight = (profile.targetWeightKg ?? 70) + (profile.goal === 'lose' ? 4.5 : profile.goal === 'gain' ? -3 : 0);
const drift = profile.goal === 'lose' ? -0.06 : profile.goal === 'gain' ? 0.035 : 0;

const foodRows: Array<typeof schema.foodEntries.$inferInsert> = [];
const waterRows: Array<typeof schema.waterEntries.$inferInsert> = [];
const stepRows: Array<typeof schema.stepDays.$inferInsert> = [];
const workoutRows: Array<typeof schema.workouts.$inferInsert> = [];
const weightRows: Array<typeof schema.weightEntries.$inferInsert> = [];
const sleepRows: Array<typeof schema.sleepEntries.$inferInsert> = [];
const moodRows: Array<typeof schema.moodEntries.$inferInsert> = [];
const mindfulRows: Array<typeof schema.mindfulSessions.$inferInsert> = [];
const vitalRows: Array<typeof schema.vitals.$inferInsert> = [];

for (let i = 0; i < days; i++) {
  const day = addDays(start, i);
  const weekend = [0, 6].includes(new Date(`${day}T12:00:00`).getDay());
  const isToday = day === today;

  // Sleep (filed under the morning you woke up)
  const sleepHours = between(5.8, 8.6) + (weekend ? 0.5 : 0);
  const bed = new Date(`${addDays(day, -1)}T22:30:00`);
  bed.setMinutes(bed.getMinutes() + between(-45, 80));
  const wake = new Date(bed.getTime() + sleepHours * 3600_000);
  const quality = Math.max(1, Math.min(5, Math.round(sleepHours - 3.2 + between(-0.8, 0.8))));
  sleepRows.push({ userId: user.id, sleptOn: day, bedAt: bed, wakeAt: wake, quality, awakenings: Math.floor(between(0, 3)) });

  // Food: today only gets breakfast and lunch so the dashboard looks mid-day.
  for (const meal of MEALS) {
    if (isToday && (meal === 'dinner' || meal === 'snack')) continue;
    if (meal === 'snack' && chance(0.3)) continue;
    for (const name of pick(MENU[meal]!)) {
      const food = byName.get(name);
      if (!food) continue;
      const servings = pick([1, 1, 1, 1.5, 0.5]);
      foodRows.push({
        userId: user.id,
        loggedOn: day,
        meal,
        foodId: food.id,
        name: food.name,
        emoji: food.emoji,
        servings,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories * servings,
        proteinG: food.proteinG * servings,
        carbsG: food.carbsG * servings,
        fatG: food.fatG * servings,
        fiberG: food.fiberG * servings,
        sugarG: food.sugarG * servings,
        sodiumMg: food.sodiumMg * servings,
      });
    }
  }

  // Water
  const glasses = isToday ? 4 : Math.round(between(5, 12));
  for (let g = 0; g < glasses; g++) waterRows.push({ userId: user.id, loggedOn: day, amountMl: 250 });

  // Steps & workouts; better sleep nudges activity and mood up, as in real life.
  const steps = Math.round((weekend ? between(3500, 9000) : between(6000, 13500)) * (0.85 + (sleepHours - 6) * 0.06) * (isToday ? 0.55 : 1));
  stepRows.push({ userId: user.id, day, steps, activeMinutes: Math.round(steps / 260), floors: Math.round(between(2, 14)) });
  if (chance(0.45) && !isToday) {
    const type: WorkoutType = pick(['running', 'strength', 'yoga', 'cycling', 'walking', 'hiit', 'swimming']);
    const intensity: Intensity = pick(['light', 'moderate', 'moderate', 'vigorous']);
    const durationMin = pick([20, 30, 30, 45, 60]);
    workoutRows.push({
      userId: user.id,
      performedOn: day,
      type,
      intensity,
      durationMin,
      caloriesBurned: workoutCalories(type, intensity, durationMin, weight),
      distanceKm: ['running', 'cycling', 'walking', 'swimming'].includes(type) ? Math.round(durationMin * (type === 'cycling' ? 0.35 : type === 'swimming' ? 0.03 : 0.12) * 10) / 10 : null,
      avgHeartRate: Math.round(between(105, 160)),
    });
  }

  // Weight: a slow drift plus daily water noise, weighed most mornings.
  weight += drift + between(-0.05, 0.05);
  if (chance(0.75) || i === 0) weightRows.push({ userId: user.id, measuredOn: day, weightKg: Math.round((weight + between(-0.5, 0.5)) * 10) / 10 });

  // Mood
  if (chance(0.8)) {
    const mood = Math.max(1, Math.min(5, Math.round(2.2 + (sleepHours - 6) * 0.6 + steps / 9000 + between(-0.8, 0.8))));
    const tags = [pick(['work', 'family', 'friends', 'exercise', 'sleep', 'food', 'study', 'nature'])];
    if (chance(0.4)) tags.push(pick(['weather', 'health', 'hobbies', 'money']));
    moodRows.push({
      userId: user.id,
      loggedOn: day,
      loggedAt: new Date(`${day}T21:00:00`),
      mood,
      energy: Math.max(1, Math.min(5, Math.round(mood + between(-1, 1)))),
      stress: Math.max(1, Math.min(5, Math.round(5 - mood + between(-0.5, 1.2)))),
      tags: [...new Set(tags)],
      note: mood >= 4 && chance(0.4) ? pick(['Great walk in the evening.', 'Productive day!', 'Lovely dinner with family.', 'Felt strong at the gym.']) : null,
    });
  }
  if (chance(0.3)) mindfulRows.push({ userId: user.id, loggedOn: day, pattern: pick(['box', 'relax', 'coherent']), durationSec: pick([60, 120, 300]) });

  // Vitals every few days
  if (i % 3 === 0) {
    vitalRows.push({ userId: user.id, kind: 'heart_rate', measuredAt: new Date(`${day}T07:30:00`), measuredOn: day, value: Math.round(between(58, 72)) });
    vitalRows.push({ userId: user.id, kind: 'blood_pressure', measuredAt: new Date(`${day}T07:35:00`), measuredOn: day, value: Math.round(between(112, 128)), value2: Math.round(between(72, 84)) });
  }
  if (i % 7 === 0) vitalRows.push({ userId: user.id, kind: 'glucose', measuredAt: new Date(`${day}T07:00:00`), measuredOn: day, value: Math.round(between(82, 98)), context: 'fasting' });
}

await db.transaction(async (tx) => {
  const chunks = <T>(rows: T[], size = 500) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
  for (const c of chunks(foodRows)) await tx.insert(schema.foodEntries).values(c);
  for (const c of chunks(waterRows)) await tx.insert(schema.waterEntries).values(c);
  for (const c of chunks(stepRows)) await tx.insert(schema.stepDays).values(c).onConflictDoNothing();
  if (workoutRows.length) await tx.insert(schema.workouts).values(workoutRows);
  for (const c of chunks(weightRows)) await tx.insert(schema.weightEntries).values(c).onConflictDoNothing();
  await tx.insert(schema.sleepEntries).values(sleepRows).onConflictDoNothing();
  if (moodRows.length) await tx.insert(schema.moodEntries).values(moodRows);
  if (mindfulRows.length) await tx.insert(schema.mindfulSessions).values(mindfulRows);
  if (vitalRows.length) await tx.insert(schema.vitals).values(vitalRows);

  // Habits: check off the user's own habits on most days.
  const habits = await tx.select().from(schema.habits).where(and(eq(schema.habits.userId, user.id), isNull(schema.habits.archivedAt)));
  const checkins = habits.flatMap((h, hi) =>
    Array.from({ length: days }, (_, i) => addDays(start, i))
      .filter((d) => d !== today && chance(hi === 0 ? 0.92 : 0.7))
      .map((d) => ({ habitId: h.id, userId: user.id, day: d, count: h.targetPerDay })),
  );
  for (const c of chunks(checkins)) await tx.insert(schema.habitCheckins).values(c).onConflictDoNothing();

  // A supplement with doses taken on past days, and a couple of completed fasts.
  const [med] = await tx
    .insert(schema.medications)
    .values({ userId: user.id, name: 'Vitamin D3', dosage: '1000 IU', instructions: 'With breakfast', times: ['08:30'], startedOn: start, color: '#e6c34a' })
    .returning();
  const doses = Array.from({ length: days - 1 }, (_, i) => addDays(start, i))
    .filter(() => chance(0.85))
    .map((d) => ({ medicationId: med!.id, userId: user.id, day: d, time: '08:30', status: 'taken' as const, takenAt: new Date(`${d}T08:40:00`) }));
  for (const c of chunks(doses)) await tx.insert(schema.medicationDoses).values(c);
  for (const back of [9, 5, 2]) {
    const startedAt = new Date(`${addDays(today, -back)}T20:00:00`);
    await tx.insert(schema.fasts).values({ userId: user.id, startedAt, endedAt: new Date(startedAt.getTime() + between(14, 17.5) * 3600_000), targetHours: 16 });
  }
  await tx.insert(schema.bodyMeasurements).values([
    { userId: user.id, measuredOn: start, waistCm: 88, hipsCm: 101, neckCm: 37, chestCm: 98, armCm: 31, thighCm: 57 },
    { userId: user.id, measuredOn: addDays(today, -3), waistCm: 85.5, hipsCm: 99.5, neckCm: 36.5, chestCm: 97, armCm: 31.5, thighCm: 56 },
  ]).onConflictDoNothing();
});

console.log(`Added ${days} days of sample data to ${email}: ${foodRows.length} foods, ${workoutRows.length} workouts, ${weightRows.length} weigh-ins.`);
await pool.end();
