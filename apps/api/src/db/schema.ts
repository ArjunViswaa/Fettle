import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  ActivityLevel,
  FoodCategory,
  GlucoseContext,
  Goal,
  Intensity,
  Meal,
  Sex,
  UnitSystem,
  VitalKind,
  WorkoutType,
  DoseStatus,
} from '@fettle/shared';

// Categorical columns are plain text typed in TypeScript (validated by zod at the API edge),
// so adding a workout type or vital kind never needs an enum migration.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const userRef = () =>
  text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });

// Auth (shape dictated by Better Auth) ---------------------------------------

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: userRef(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const authAccounts = pgTable(
  'auth_accounts',
  {
    id: text('id').primaryKey(),
    userId: userRef(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('auth_accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Profile -------------------------------------------------------------------

export const profiles = pgTable('profiles', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sex: text('sex').$type<Sex>().notNull(),
  birthDate: date('birth_date').notNull(),
  heightCm: doublePrecision('height_cm').notNull(),
  activityLevel: text('activity_level').$type<ActivityLevel>().notNull(),
  goal: text('goal').$type<Goal>().notNull(),
  targetWeightKg: doublePrecision('target_weight_kg'),
  weeklyRateKg: doublePrecision('weekly_rate_kg').notNull().default(0.5),
  unitSystem: text('unit_system').$type<UnitSystem>().notNull().default('metric'),
  calorieTarget: integer('calorie_target').notNull(),
  proteinTargetG: integer('protein_target_g').notNull(),
  carbsTargetG: integer('carbs_target_g').notNull(),
  fatTargetG: integer('fat_target_g').notNull(),
  fiberTargetG: integer('fiber_target_g').notNull(),
  waterTargetMl: integer('water_target_ml').notNull(),
  stepTarget: integer('step_target').notNull(),
  sleepTargetMinutes: integer('sleep_target_minutes').notNull(),
  activeMinutesTarget: integer('active_minutes_target').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Nutrition -----------------------------------------------------------------

const nutrientColumns = () => ({
  calories: doublePrecision('calories').notNull(),
  proteinG: doublePrecision('protein_g').notNull().default(0),
  carbsG: doublePrecision('carbs_g').notNull().default(0),
  fatG: doublePrecision('fat_g').notNull().default(0),
  fiberG: doublePrecision('fiber_g').notNull().default(0),
  sugarG: doublePrecision('sugar_g').notNull().default(0),
  sodiumMg: doublePrecision('sodium_mg').notNull().default(0),
});

/** Built-in catalogue rows have no user; custom foods belong to one user. Nutrients are per serving. */
export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brand: text('brand'),
    emoji: text('emoji'),
    category: text('category').$type<FoodCategory>().notNull(),
    servingSize: doublePrecision('serving_size').notNull(),
    servingUnit: text('serving_unit').notNull(),
    ...nutrientColumns(),
    createdAt: createdAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('foods_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')), index('foods_user_idx').on(t.userId)],
);

/** Nutrients are copied in at log time, so editing or deleting a food never rewrites history. */
export const foodEntries = pgTable(
  'food_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    loggedOn: date('logged_on').notNull(),
    meal: text('meal').$type<Meal>().notNull(),
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    emoji: text('emoji'),
    servings: doublePrecision('servings').notNull().default(1),
    servingSize: doublePrecision('serving_size'),
    servingUnit: text('serving_unit'),
    ...nutrientColumns(),
    createdAt: createdAt(),
  },
  (t) => [index('food_entries_user_day_idx').on(t.userId, t.loggedOn), index('food_entries_food_idx').on(t.userId, t.foodId)],
);

export const waterEntries = pgTable(
  'water_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    loggedOn: date('logged_on').notNull(),
    amountMl: integer('amount_ml').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('water_entries_user_day_idx').on(t.userId, t.loggedOn)],
);

// Body ----------------------------------------------------------------------

export const weightEntries = pgTable(
  'weight_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    measuredOn: date('measured_on').notNull(),
    weightKg: doublePrecision('weight_kg').notNull(),
    bodyFatPct: doublePrecision('body_fat_pct'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('weight_entries_user_day_uq').on(t.userId, t.measuredOn)],
);

export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    measuredOn: date('measured_on').notNull(),
    neckCm: doublePrecision('neck_cm'),
    chestCm: doublePrecision('chest_cm'),
    waistCm: doublePrecision('waist_cm'),
    hipsCm: doublePrecision('hips_cm'),
    armCm: doublePrecision('arm_cm'),
    thighCm: doublePrecision('thigh_cm'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('body_measurements_user_day_uq').on(t.userId, t.measuredOn)],
);

// Activity ------------------------------------------------------------------

export const stepDays = pgTable(
  'step_days',
  {
    userId: userRef(),
    day: date('day').notNull(),
    steps: integer('steps').notNull(),
    activeMinutes: integer('active_minutes'),
    floors: integer('floors'),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    performedOn: date('performed_on').notNull(),
    type: text('type').$type<WorkoutType>().notNull(),
    title: text('title'),
    durationMin: integer('duration_min').notNull(),
    intensity: text('intensity').$type<Intensity>().notNull(),
    caloriesBurned: integer('calories_burned').notNull(),
    distanceKm: doublePrecision('distance_km'),
    avgHeartRate: integer('avg_heart_rate'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [index('workouts_user_day_idx').on(t.userId, t.performedOn)],
);

// Sleep & mind --------------------------------------------------------------

export const sleepEntries = pgTable(
  'sleep_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    sleptOn: date('slept_on').notNull(),
    bedAt: timestamp('bed_at', { withTimezone: true }).notNull(),
    wakeAt: timestamp('wake_at', { withTimezone: true }).notNull(),
    quality: smallint('quality').notNull(),
    awakenings: smallint('awakenings').notNull().default(0),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('sleep_entries_user_day_uq').on(t.userId, t.sleptOn)],
);

export const moodEntries = pgTable(
  'mood_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    loggedOn: date('logged_on').notNull(),
    loggedAt: timestamp('logged_at', { withTimezone: true }).notNull().defaultNow(),
    mood: smallint('mood').notNull(),
    energy: smallint('energy').notNull(),
    stress: smallint('stress').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    note: text('note'),
  },
  (t) => [index('mood_entries_user_day_idx').on(t.userId, t.loggedOn)],
);

export const mindfulSessions = pgTable(
  'mindful_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    loggedOn: date('logged_on').notNull(),
    pattern: text('pattern').notNull(),
    durationSec: integer('duration_sec').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('mindful_sessions_user_day_idx').on(t.userId, t.loggedOn)],
);

// Vitals --------------------------------------------------------------------

export const vitals = pgTable(
  'vitals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    kind: text('kind').$type<VitalKind>().notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true }).notNull(),
    measuredOn: date('measured_on').notNull(),
    value: doublePrecision('value').notNull(),
    value2: doublePrecision('value2'),
    context: text('context').$type<GlucoseContext>(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('vitals_user_kind_time_idx').on(t.userId, t.kind, t.measuredAt)],
);

// Habits & medication -------------------------------------------------------

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    name: text('name').notNull(),
    emoji: text('emoji').notNull(),
    color: text('color').notNull(),
    targetPerDay: smallint('target_per_day').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('habits_user_idx').on(t.userId)],
);

export const habitCheckins = pgTable(
  'habit_checkins',
  {
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    userId: userRef(),
    day: date('day').notNull(),
    count: smallint('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.day] }), index('habit_checkins_user_day_idx').on(t.userId, t.day)],
);

export const medications = pgTable(
  'medications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    name: text('name').notNull(),
    dosage: text('dosage'),
    instructions: text('instructions'),
    times: text('times').array().notNull(),
    startedOn: date('started_on').notNull(),
    endsOn: date('ends_on'),
    color: text('color').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('medications_user_idx').on(t.userId)],
);

export const medicationDoses = pgTable(
  'medication_doses',
  {
    medicationId: uuid('medication_id')
      .notNull()
      .references(() => medications.id, { onDelete: 'cascade' }),
    userId: userRef(),
    day: date('day').notNull(),
    time: text('time').notNull(),
    status: text('status').$type<DoseStatus>().notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.medicationId, t.day, t.time] }), index('medication_doses_user_day_idx').on(t.userId, t.day)],
);

// Fasting & achievements ----------------------------------------------------

export const fasts = pgTable(
  'fasts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    targetHours: doublePrecision('target_hours').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('fasts_user_started_idx').on(t.userId, t.startedAt),
    // At most one fast in progress per person.
    uniqueIndex('fasts_one_active_uq').on(t.userId).where(sql`${t.endedAt} is null`),
  ],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: userRef(),
    code: text('code').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);
