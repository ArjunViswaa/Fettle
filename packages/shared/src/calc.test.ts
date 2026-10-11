import { describe, expect, it } from 'vitest';
import { bmr, currentStreak, daysToGoal, fettleScore, longestStreak, navyBodyFat, suggestTargets, weightTrend } from './calc.js';
import { ageOn, eachDay } from './dates.js';

describe('energy maths', () => {
  it('matches the published Mifflin–St Jeor example', () => {
    // 30-year-old man, 80 kg, 180 cm: 10*80 + 6.25*180 - 5*30 + 5
    expect(bmr('male', 80, 180, 30)).toBe(1780);
  });

  it('builds a deficit for weight loss but never below the floor', () => {
    const t = suggestTargets({ sex: 'female', weightKg: 50, heightCm: 150, age: 60, activityLevel: 'sedentary', goal: 'lose', weeklyRateKg: 1 });
    expect(t.calories).toBe(1200);
    const m = suggestTargets({ sex: 'male', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'moderate', goal: 'maintain', weeklyRateKg: 0 });
    expect(m.calories).toBe(2760);
    // macros add back up to roughly the calorie target
    expect(Math.abs(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9 - m.calories)).toBeLessThan(15);
  });
});

describe('body composition', () => {
  it('estimates navy body fat in a plausible range', () => {
    const male = navyBodyFat('male', 178, 38, 86);
    expect(male).toBeGreaterThan(12);
    expect(male).toBeLessThan(20);
    expect(navyBodyFat('female', 165, 33, 72)).toBeNull(); // hips are required for women
  });
});

describe('weight trend', () => {
  it('smooths daily noise and bridges gaps', () => {
    const trend = weightTrend([
      { day: '2026-01-01', weightKg: 80 },
      { day: '2026-01-02', weightKg: 81 },
      { day: '2026-01-12', weightKg: 79 },
    ]);
    expect(trend[1]!.trendKg).toBeCloseTo(80.1, 2);
    // a ten-day gap pulls the trend most of the way to the new reading
    expect(trend[2]!.trendKg).toBeLessThan(79.8);
  });

  it('only projects a goal date when heading towards it', () => {
    expect(daysToGoal(80, 75, -0.1)).toBe(50);
    expect(daysToGoal(80, 75, 0.1)).toBeNull();
  });
});

describe('streaks', () => {
  it('counts back from today, or from yesterday if today is still empty', () => {
    const days = eachDay('2026-03-01', '2026-03-05');
    expect(currentStreak(days, '2026-03-05')).toBe(5);
    expect(currentStreak(days, '2026-03-06')).toBe(5);
    expect(currentStreak(days, '2026-03-07')).toBe(0);
    expect(longestStreak([...days, '2026-03-09', '2026-03-10'])).toBe(5);
  });
});

describe('fettle score', () => {
  it('gives full marks for a complete, on-target day', () => {
    const s = fettleScore({ caloriesEaten: 2000, calorieTarget: 2000, proteinRatio: 1, waterRatio: 1, stepsRatio: 1, activeRatio: 1, sleepRatio: 1, mood: 5 });
    expect(s.total).toBe(100);
  });
  it('starts at zero for an empty day', () => {
    const s = fettleScore({ caloriesEaten: 0, calorieTarget: 2000, proteinRatio: 0, waterRatio: 0, stepsRatio: 0, activeRatio: 0, sleepRatio: null, mood: null });
    expect(s.total).toBe(0);
  });
});

describe('dates', () => {
  it('computes age around birthdays', () => {
    expect(ageOn('1990-06-15', '2026-06-14')).toBe(35);
    expect(ageOn('1990-06-15', '2026-06-15')).toBe(36);
  });
});
