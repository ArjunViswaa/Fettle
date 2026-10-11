import { z } from 'zod';
import {
  ACTIVITY_LEVELS,
  FOOD_CATEGORIES,
  GLUCOSE_CONTEXTS,
  GOALS,
  INTENSITIES,
  MEALS,
  SEXES,
  UNIT_SYSTEMS,
  VITAL_KINDS,
  WORKOUT_TYPES,
} from './constants.js';

export const isoDate = z.iso.date();
export const dateRange = z.object({ from: isoDate, to: isoDate });
export const dayQuery = z.object({ date: isoDate });

const kcal = z.number().min(0).max(20_000);
const grams = z.number().min(0).max(5_000);
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const text = (max: number) => z.string().trim().max(max);

// Profile -------------------------------------------------------------------

export const targetsInput = z.object({
  calorieTarget: z.number().int().min(800).max(8000),
  proteinTargetG: z.number().int().min(0).max(600),
  carbsTargetG: z.number().int().min(0).max(1200),
  fatTargetG: z.number().int().min(0).max(400),
  fiberTargetG: z.number().int().min(0).max(150),
  waterTargetMl: z.number().int().min(250).max(8000),
  stepTarget: z.number().int().min(500).max(60_000),
  sleepTargetMinutes: z.number().int().min(240).max(720),
  activeMinutesTarget: z.number().int().min(5).max(600),
});
export type TargetsInput = z.infer<typeof targetsInput>;

export const profileInput = targetsInput.extend({
  sex: z.enum(SEXES),
  birthDate: isoDate,
  heightCm: z.number().min(80).max(260),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(GOALS),
  targetWeightKg: z.number().min(25).max(400).nullable(),
  weeklyRateKg: z.number().min(0).max(1.5),
  unitSystem: z.enum(UNIT_SYSTEMS),
  /** Only sent during onboarding, to record the starting weight. */
  startWeightKg: z.number().min(25).max(400).optional(),
  startDate: isoDate.optional(),
});
export type ProfileInput = z.infer<typeof profileInput>;

export const profileUpdate = profileInput.partial();
export type ProfileUpdate = z.infer<typeof profileUpdate>;

// Nutrition -----------------------------------------------------------------

export const nutrientsInput = z.object({
  calories: kcal,
  proteinG: grams,
  carbsG: grams,
  fatG: grams,
  fiberG: grams.default(0),
  sugarG: grams.default(0),
  sodiumMg: z.number().min(0).max(50_000).default(0),
});

export const foodInput = nutrientsInput.extend({
  name: text(120).min(1),
  brand: text(80).nullish(),
  emoji: text(8).nullish(),
  category: z.enum(FOOD_CATEGORIES).default('meals'),
  servingSize: z.number().positive().max(5000),
  servingUnit: text(24).min(1),
});
export type FoodInput = z.input<typeof foodInput>;

export const foodSearchQuery = z.object({
  q: z.string().trim().max(80).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const foodEntryInput = z.object({
  loggedOn: isoDate,
  meal: z.enum(MEALS),
  /** Either a food from the catalogue with a number of servings... */
  foodId: z.uuid().optional(),
  servings: z.number().positive().max(100).default(1),
  /** ...or a quick entry with its own name and nutrients. */
  quick: nutrientsInput.extend({ name: text(120).min(1) }).optional(),
});
export type FoodEntryInput = z.input<typeof foodEntryInput>;

export const foodEntryUpdate = z.object({
  meal: z.enum(MEALS).optional(),
  servings: z.number().positive().max(100).optional(),
  loggedOn: isoDate.optional(),
});
export type FoodEntryUpdate = z.infer<typeof foodEntryUpdate>;

export const copyMealInput = z.object({ fromDate: isoDate, toDate: isoDate, meal: z.enum(MEALS).optional() });
export type CopyMealInput = z.infer<typeof copyMealInput>;

export const waterInput = z.object({ loggedOn: isoDate, amountMl: z.number().int().min(-5000).max(5000) });
export type WaterInput = z.infer<typeof waterInput>;

// Body ----------------------------------------------------------------------

export const weightInput = z.object({
  measuredOn: isoDate,
  weightKg: z.number().min(25).max(400),
  bodyFatPct: z.number().min(2).max(70).nullish(),
  note: text(200).nullish(),
});
export type WeightInput = z.infer<typeof weightInput>;

const cm = z.number().min(10).max(300).nullish();
export const measurementInput = z.object({
  measuredOn: isoDate,
  neckCm: cm,
  chestCm: cm,
  waistCm: cm,
  hipsCm: cm,
  armCm: cm,
  thighCm: cm,
});
export type MeasurementInput = z.infer<typeof measurementInput>;

// Activity ------------------------------------------------------------------

export const stepsInput = z.object({
  day: isoDate,
  steps: z.number().int().min(0).max(150_000),
  activeMinutes: z.number().int().min(0).max(1440).nullish(),
  floors: z.number().int().min(0).max(500).nullish(),
});
export type StepsInput = z.infer<typeof stepsInput>;

export const workoutInput = z.object({
  performedOn: isoDate,
  type: z.enum(WORKOUT_TYPES),
  title: text(80).nullish(),
  durationMin: z.number().int().min(1).max(1440),
  intensity: z.enum(INTENSITIES),
  /** Leave out to let the server estimate it from MET values and your weight. */
  caloriesBurned: z.number().int().min(0).max(10_000).nullish(),
  distanceKm: z.number().min(0).max(1000).nullish(),
  avgHeartRate: z.number().int().min(30).max(240).nullish(),
  notes: text(500).nullish(),
});
export type WorkoutInput = z.infer<typeof workoutInput>;
export const workoutUpdate = workoutInput.partial();
export type WorkoutUpdate = z.infer<typeof workoutUpdate>;

// Sleep ---------------------------------------------------------------------

export const sleepInput = z
  .object({
    bedAt: z.iso.datetime({ offset: true }),
    wakeAt: z.iso.datetime({ offset: true }),
    /** The morning you woke up; the night is filed under this day. */
    sleptOn: isoDate,
    quality: z.number().int().min(1).max(5),
    awakenings: z.number().int().min(0).max(50).default(0),
    notes: text(500).nullish(),
  })
  .refine((s) => new Date(s.wakeAt) > new Date(s.bedAt), { message: 'Wake time must be after bedtime', path: ['wakeAt'] })
  .refine((s) => new Date(s.wakeAt).getTime() - new Date(s.bedAt).getTime() <= 20 * 3600_000, {
    message: 'That is more than 20 hours of sleep',
    path: ['wakeAt'],
  });
export type SleepInput = z.input<typeof sleepInput>;

// Mind ----------------------------------------------------------------------

export const moodInput = z.object({
  loggedOn: isoDate,
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  tags: z.array(text(24)).max(10).default([]),
  note: text(1000).nullish(),
});
export type MoodInput = z.input<typeof moodInput>;

export const mindfulInput = z.object({
  loggedOn: isoDate,
  pattern: text(24),
  durationSec: z.number().int().min(10).max(4 * 3600),
});
export type MindfulInput = z.infer<typeof mindfulInput>;

// Vitals --------------------------------------------------------------------

export const vitalInput = z.object({
  kind: z.enum(VITAL_KINDS),
  measuredAt: z.iso.datetime({ offset: true }),
  measuredOn: isoDate,
  value: z.number().min(0).max(1000),
  /** Diastolic pressure for blood_pressure. */
  value2: z.number().min(0).max(300).nullish(),
  context: z.enum(GLUCOSE_CONTEXTS).nullish(),
  note: text(200).nullish(),
});
export type VitalInput = z.infer<typeof vitalInput>;

export const vitalQuery = dateRange.extend({ kind: z.enum(VITAL_KINDS).optional() });

// Habits & medication -------------------------------------------------------

export const habitInput = z.object({
  name: text(60).min(1),
  emoji: text(8).default('✨'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  targetPerDay: z.number().int().min(1).max(20).default(1),
});
export type HabitInput = z.input<typeof habitInput>;
export const habitUpdate = habitInput.partial().extend({ archived: z.boolean().optional(), sortOrder: z.number().int().optional() });
export type HabitUpdate = z.infer<typeof habitUpdate>;

export const checkinInput = z.object({ count: z.number().int().min(0).max(20) });

export const medicationInput = z.object({
  name: text(80).min(1),
  dosage: text(60).nullish(),
  instructions: text(200).nullish(),
  times: z.array(clockTime).min(1).max(8),
  startedOn: isoDate,
  endsOn: isoDate.nullish(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#7c6cf2'),
});
export type MedicationInput = z.input<typeof medicationInput>;
export const medicationUpdate = medicationInput.partial().extend({ archived: z.boolean().optional() });
export type MedicationUpdate = z.infer<typeof medicationUpdate>;

export const doseInput = z.object({
  day: isoDate,
  time: clockTime,
  status: z.enum(['taken', 'skipped', 'pending']),
});
export type DoseInput = z.infer<typeof doseInput>;

// Fasting -------------------------------------------------------------------

export const startFastInput = z.object({
  targetHours: z.number().min(1).max(168),
  startedAt: z.iso.datetime({ offset: true }).optional(),
});
export type StartFastInput = z.infer<typeof startFastInput>;

export const endFastInput = z.object({ endedAt: z.iso.datetime({ offset: true }).optional() });

export const meUpdate = z.object({ name: text(80).min(1) });
