import type {
  AchievementCode,
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
} from './constants.js';
import type { ScorePart } from './calc.js';

export interface Me {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  onboarded: boolean;
}

export interface Profile {
  sex: Sex;
  birthDate: string;
  age: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg: number | null;
  weeklyRateKg: number;
  unitSystem: UnitSystem;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  fiberTargetG: number;
  waterTargetMl: number;
  stepTarget: number;
  sleepTargetMinutes: number;
  activeMinutesTarget: number;
  startWeightKg: number | null;
  latestWeightKg: number | null;
}

export interface Nutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export interface Food extends Nutrients {
  id: string;
  name: string;
  brand: string | null;
  emoji: string | null;
  category: FoodCategory;
  servingSize: number;
  servingUnit: string;
  custom: boolean;
}

export interface FoodEntry extends Nutrients {
  id: string;
  loggedOn: string;
  meal: Meal;
  foodId: string | null;
  name: string;
  emoji: string | null;
  servings: number;
  servingSize: number | null;
  servingUnit: string | null;
  createdAt: string;
}

export interface WeightEntry {
  id: string;
  measuredOn: string;
  weightKg: number;
  bodyFatPct: number | null;
  note: string | null;
}

export interface Measurement {
  id: string;
  measuredOn: string;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  armCm: number | null;
  thighCm: number | null;
}

export interface StepDay {
  day: string;
  steps: number;
  activeMinutes: number | null;
  floors: number | null;
}

export interface Workout {
  id: string;
  performedOn: string;
  type: WorkoutType;
  title: string | null;
  durationMin: number;
  intensity: Intensity;
  caloriesBurned: number;
  distanceKm: number | null;
  avgHeartRate: number | null;
  notes: string | null;
  createdAt: string;
}

export interface SleepEntry {
  id: string;
  sleptOn: string;
  bedAt: string;
  wakeAt: string;
  minutes: number;
  quality: number;
  awakenings: number;
  notes: string | null;
}

export interface MoodEntry {
  id: string;
  loggedOn: string;
  loggedAt: string;
  mood: number;
  energy: number;
  stress: number;
  tags: string[];
  note: string | null;
}

export interface MindfulSession {
  id: string;
  loggedOn: string;
  pattern: string;
  durationSec: number;
  createdAt: string;
}

export interface Vital {
  id: string;
  kind: VitalKind;
  measuredAt: string;
  measuredOn: string;
  value: number;
  value2: number | null;
  context: GlucoseContext | null;
  note: string | null;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  targetPerDay: number;
  sortOrder: number;
  createdAt: string;
  /** day -> count, for the requested range */
  checkins: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  instructions: string | null;
  times: string[];
  startedOn: string;
  endsOn: string | null;
  color: string;
  archived: boolean;
}

export type DoseStatus = 'taken' | 'skipped' | 'pending';

export interface DoseSlot {
  medicationId: string;
  name: string;
  dosage: string | null;
  color: string;
  time: string;
  status: DoseStatus;
  takenAt: string | null;
}

export interface Fast {
  id: string;
  startedAt: string;
  endedAt: string | null;
  targetHours: number;
}

export interface DaySummary {
  date: string;
  nutrition: Nutrients & { byMeal: Record<Meal, Nutrients & { count: number }> };
  waterMl: number;
  steps: StepDay | null;
  workouts: Workout[];
  burned: { workouts: number; steps: number; total: number };
  activeMinutes: number;
  sleep: SleepEntry | null;
  mood: MoodEntry | null;
  mindfulMinutes: number;
  weight: { latest: WeightEntry | null; previous: WeightEntry | null };
  habits: Array<{ id: string; name: string; emoji: string; color: string; targetPerDay: number; count: number; streak: number }>;
  doses: DoseSlot[];
  activeFast: Fast | null;
  streak: number;
  score: { total: number; parts: ScorePart[] };
}

/** One row per calendar day for charts; null means nothing was logged. */
export interface DailyPoint {
  day: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  waterMl: number | null;
  steps: number | null;
  activeMinutes: number | null;
  workoutMinutes: number | null;
  burned: number | null;
  sleepMinutes: number | null;
  sleepQuality: number | null;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  weightKg: number | null;
}

export interface Achievement {
  code: AchievementCode;
  title: string;
  hint: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold';
  unlockedAt: string | null;
}

export interface AchievementsResponse {
  all: Achievement[];
  newlyUnlocked: AchievementCode[];
}
