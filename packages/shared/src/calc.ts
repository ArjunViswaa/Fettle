import { ACTIVITY_INFO, WORKOUT_INFO, type ActivityLevel, type Goal, type Intensity, type Sex, type WorkoutType } from './constants.js';
import { addDays, daysBetween } from './dates.js';

const KCAL_PER_KG = 7700;

const round = (n: number, step = 1) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Mifflin–St Jeor resting energy expenditure, kcal/day. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: ActivityLevel): number {
  return bmr(sex, weightKg, heightCm, age) * ACTIVITY_INFO[activity].factor;
}

export interface TargetInputs {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** kg per week, always positive; direction comes from the goal. */
  weeklyRateKg: number;
}

export interface Targets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
  steps: number;
  sleepMinutes: number;
  activeMinutes: number;
}

/** Sensible daily targets from a profile. Users can override each one afterwards. */
export function suggestTargets(p: TargetInputs): Targets {
  const maintenance = tdee(p.sex, p.weightKg, p.heightCm, p.age, p.activityLevel);
  const dailyDelta = (p.weeklyRateKg * KCAL_PER_KG) / 7;
  const floor = p.sex === 'male' ? 1500 : 1200;
  let calories = maintenance;
  if (p.goal === 'lose') calories = Math.max(floor, maintenance - dailyDelta);
  if (p.goal === 'gain') calories = maintenance + Math.min(dailyDelta, 500);
  calories = round(calories, 10);

  const proteinPerKg = p.goal === 'maintain' ? 1.4 : 1.8;
  const proteinG = round(Math.min(p.weightKg * proteinPerKg, (calories * 0.35) / 4));
  const fatG = round((calories * 0.28) / 9);
  const carbsG = Math.max(0, round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG: round((calories / 1000) * 14),
    waterMl: clamp(round(p.weightKg * 35, 250), 1500, 4500),
    steps: p.activityLevel === 'sedentary' ? 7000 : p.activityLevel === 'athlete' ? 12000 : 10000,
    sleepMinutes: p.age < 18 ? 540 : p.age >= 65 ? 450 : 480,
    activeMinutes: 30,
  };
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): { label: string; tone: 'low' | 'good' | 'warn' | 'high' } {
  if (value < 18.5) return { label: 'Underweight', tone: 'low' };
  if (value < 25) return { label: 'Healthy', tone: 'good' };
  if (value < 30) return { label: 'Overweight', tone: 'warn' };
  return { label: 'Obese', tone: 'high' };
}

export function healthyWeightRange(heightCm: number): [number, number] {
  const m = heightCm / 100;
  return [18.5 * m * m, 24.9 * m * m];
}

/** US Navy circumference method. Returns null when the measurements can't produce a result. */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipsCm?: number | null): number | null {
  const log = Math.log10;
  let value: number;
  if (sex === 'male') {
    if (waistCm <= neckCm) return null;
    value = 495 / (1.0324 - 0.19077 * log(waistCm - neckCm) + 0.15456 * log(heightCm)) - 450;
  } else {
    if (!hipsCm || waistCm + hipsCm <= neckCm) return null;
    value = 495 / (1.29579 - 0.35004 * log(waistCm + hipsCm - neckCm) + 0.221 * log(heightCm)) - 450;
  }
  return Number.isFinite(value) && value > 2 && value < 70 ? Math.round(value * 10) / 10 : null;
}

export function workoutCalories(type: WorkoutType, intensity: Intensity, minutes: number, weightKg: number): number {
  const met = WORKOUT_INFO[type].met[intensity];
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}

/** Calories from walking the given steps, beyond resting burn. Roughly 0.04 kcal per step at 70 kg. */
export function stepCalories(steps: number, weightKg: number): number {
  return Math.round(steps * 0.04 * (weightKg / 70));
}

export function stepDistanceKm(steps: number, heightCm: number): number {
  const strideM = (heightCm * 0.415) / 100;
  return Math.round(((steps * strideM) / 1000) * 100) / 100;
}

export function sleepMinutes(bedAt: string, wakeAt: string): number {
  return Math.max(0, Math.round((new Date(wakeAt).getTime() - new Date(bedAt).getTime()) / 60_000));
}

export interface WeightPoint {
  day: string;
  weightKg: number;
}

/**
 * Exponentially smoothed weight (as in "The Hacker's Diet"): daily water swings flatten out
 * and the real direction shows. Gaps between weigh-ins are bridged by compounding the factor.
 */
export function weightTrend(points: WeightPoint[], smoothing = 0.1): Array<WeightPoint & { trendKg: number }> {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  let trend: number | null = null;
  let lastDay: string | null = null;
  return sorted.map((p) => {
    if (trend === null || lastDay === null) {
      trend = p.weightKg;
    } else {
      const gap = Math.max(1, daysBetween(lastDay, p.day));
      const alpha = 1 - Math.pow(1 - smoothing, gap);
      trend = trend + alpha * (p.weightKg - trend);
    }
    lastDay = p.day;
    return { ...p, trendKg: Math.round(trend * 100) / 100 };
  });
}

/** Least-squares slope in units per day. */
export function slopePerDay(points: Array<{ day: string; value: number }>): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.day;
  const xs = points.map((p) => daysBetween(first, p.day));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** Days until the trend reaches the target at the current pace, or null if it's heading the other way. */
export function daysToGoal(currentKg: number, targetKg: number, kgPerDay: number | null): number | null {
  if (!kgPerDay || Math.abs(currentKg - targetKg) < 0.1) return null;
  const days = (targetKg - currentKg) / kgPerDay;
  return days > 0 && days < 3650 ? Math.ceil(days) : null;
}

/** Pearson correlation of paired values; null when there's too little data or no variation. */
export function correlation(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 5) return null;
  const n = pairs.length;
  const mx = pairs.reduce((a, [x]) => a + x, 0) / n;
  const my = pairs.reduce((a, [, y]) => a + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface ScoreInputs {
  caloriesEaten: number;
  calorieTarget: number;
  proteinRatio: number;
  waterRatio: number;
  stepsRatio: number;
  activeRatio: number;
  /** null when no sleep was logged for last night. */
  sleepRatio: number | null;
  /** 1–5, null when not checked in. */
  mood: number | null;
}

export interface ScorePart {
  key: 'nutrition' | 'hydration' | 'movement' | 'sleep' | 'mind';
  label: string;
  points: number;
  max: number;
}

/**
 * The daily Fettle score: 100 points spread over five pillars. It fills up through the day,
 * so it rewards showing up rather than perfection.
 */
export function fettleScore(s: ScoreInputs): { total: number; parts: ScorePart[] } {
  const capped = (r: number) => clamp(r, 0, 1);

  let calorieFit = 0;
  if (s.caloriesEaten > 0 && s.calorieTarget > 0) {
    const deviation = Math.abs(s.caloriesEaten / s.calorieTarget - 1);
    calorieFit = deviation <= 0.1 ? 1 : clamp(1 - (deviation - 0.1) / 0.4, 0, 1);
  }
  // Oversleeping a lot isn't better sleep.
  const sleepFit = s.sleepRatio === null ? 0 : s.sleepRatio > 1.25 ? clamp(1 - (s.sleepRatio - 1.25), 0.6, 1) : capped(s.sleepRatio);

  const parts: ScorePart[] = [
    { key: 'nutrition', label: 'Nutrition', max: 25, points: 25 * (0.7 * calorieFit + 0.3 * capped(s.proteinRatio)) },
    { key: 'hydration', label: 'Hydration', max: 15, points: 15 * capped(s.waterRatio) },
    { key: 'movement', label: 'Movement', max: 25, points: 25 * (0.6 * capped(s.stepsRatio) + 0.4 * capped(s.activeRatio)) },
    { key: 'sleep', label: 'Sleep', max: 25, points: 25 * sleepFit },
    { key: 'mind', label: 'Mind', max: 10, points: s.mood === null ? 0 : 10 * (0.4 + 0.6 * ((s.mood - 1) / 4)) },
  ].map((p) => ({ ...p, points: Math.round(p.points) }) as ScorePart);

  return { total: parts.reduce((a, p) => a + p.points, 0), parts };
}

/** Longest run of consecutive days ending today (or yesterday, so a streak survives until you log today). */
export function currentStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : null;
  if (!cursor) {
    const yesterday = addDays(today, -1);
    if (!set.has(yesterday)) return 0;
    cursor = yesterday;
  }
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function longestStreak(days: Iterable<string>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

