export const SEXES = ['female', 'male'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'athlete'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** Multipliers applied to BMR to estimate total daily energy expenditure. */
export const ACTIVITY_INFO: Record<ActivityLevel, { label: string; hint: string; factor: number }> = {
  sedentary: { label: 'Sedentary', hint: 'Desk job, little exercise', factor: 1.2 },
  light: { label: 'Lightly active', hint: 'Exercise 1–3 days a week', factor: 1.375 },
  moderate: { label: 'Moderately active', hint: 'Exercise 3–5 days a week', factor: 1.55 },
  active: { label: 'Very active', hint: 'Hard exercise 6–7 days a week', factor: 1.725 },
  athlete: { label: 'Athlete', hint: 'Training twice a day or a physical job', factor: 1.9 },
};

export const GOALS = ['lose', 'maintain', 'gain'] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_INFO: Record<Goal, { label: string; hint: string; emoji: string }> = {
  lose: { label: 'Lose weight', hint: 'A steady calorie deficit', emoji: '🔥' },
  maintain: { label: 'Stay balanced', hint: 'Keep weight steady, feel great', emoji: '⚖️' },
  gain: { label: 'Build up', hint: 'A lean surplus for muscle', emoji: '💪' },
};

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_INFO: Record<Meal, { label: string; emoji: string; share: number }> = {
  breakfast: { label: 'Breakfast', emoji: '🌅', share: 0.25 },
  lunch: { label: 'Lunch', emoji: '☀️', share: 0.35 },
  dinner: { label: 'Dinner', emoji: '🌙', share: 0.3 },
  snack: { label: 'Snacks', emoji: '🍎', share: 0.1 },
};

export const INTENSITIES = ['light', 'moderate', 'vigorous'] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const WORKOUT_TYPES = [
  'walking',
  'running',
  'cycling',
  'swimming',
  'strength',
  'hiit',
  'yoga',
  'pilates',
  'dance',
  'hiking',
  'sports',
  'rowing',
  'stretching',
  'other',
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

/** MET values (Compendium of Physical Activities, rounded) by intensity. */
export const WORKOUT_INFO: Record<WorkoutType, { label: string; emoji: string; met: Record<Intensity, number>; distance: boolean }> = {
  walking: { label: 'Walking', emoji: '🚶', met: { light: 2.8, moderate: 3.5, vigorous: 5 }, distance: true },
  running: { label: 'Running', emoji: '🏃', met: { light: 7, moderate: 9.8, vigorous: 11.5 }, distance: true },
  cycling: { label: 'Cycling', emoji: '🚴', met: { light: 4, moderate: 6.8, vigorous: 10 }, distance: true },
  swimming: { label: 'Swimming', emoji: '🏊', met: { light: 5.8, moderate: 8.3, vigorous: 10 }, distance: true },
  strength: { label: 'Strength', emoji: '🏋️', met: { light: 3.5, moderate: 5, vigorous: 6 }, distance: false },
  hiit: { label: 'HIIT', emoji: '⚡', met: { light: 6, moderate: 8, vigorous: 10 }, distance: false },
  yoga: { label: 'Yoga', emoji: '🧘', met: { light: 2.5, moderate: 3, vigorous: 4 }, distance: false },
  pilates: { label: 'Pilates', emoji: '🤸', met: { light: 2.8, moderate: 3, vigorous: 3.8 }, distance: false },
  dance: { label: 'Dance', emoji: '💃', met: { light: 4.5, moderate: 5.5, vigorous: 7.8 }, distance: false },
  hiking: { label: 'Hiking', emoji: '🥾', met: { light: 5.3, moderate: 6, vigorous: 7.8 }, distance: true },
  sports: { label: 'Sports', emoji: '🏸', met: { light: 4.5, moderate: 6, vigorous: 8 }, distance: false },
  rowing: { label: 'Rowing', emoji: '🚣', met: { light: 4.8, moderate: 7, vigorous: 8.5 }, distance: true },
  stretching: { label: 'Stretching', emoji: '🙆', met: { light: 2.3, moderate: 2.5, vigorous: 3 }, distance: false },
  other: { label: 'Other', emoji: '✨', met: { light: 3, moderate: 4.5, vigorous: 6 }, distance: false },
};

export const VITAL_KINDS = ['heart_rate', 'blood_pressure', 'glucose', 'spo2', 'temperature'] as const;
export type VitalKind = (typeof VITAL_KINDS)[number];

export const VITAL_INFO: Record<
  VitalKind,
  { label: string; unit: string; emoji: string; normal: [number, number]; normal2?: [number, number]; min: number; max: number; step: number }
> = {
  heart_rate: { label: 'Resting heart rate', unit: 'bpm', emoji: '❤️', normal: [60, 100], min: 25, max: 230, step: 1 },
  blood_pressure: { label: 'Blood pressure', unit: 'mmHg', emoji: '🩺', normal: [90, 120], normal2: [60, 80], min: 50, max: 260, step: 1 },
  glucose: { label: 'Blood glucose', unit: 'mg/dL', emoji: '🩸', normal: [70, 140], min: 20, max: 600, step: 1 },
  spo2: { label: 'Blood oxygen', unit: '%', emoji: '🫁', normal: [95, 100], min: 50, max: 100, step: 1 },
  temperature: { label: 'Body temperature', unit: '°C', emoji: '🌡️', normal: [36.1, 37.2], min: 30, max: 45, step: 0.1 },
};

export const GLUCOSE_CONTEXTS = ['fasting', 'before_meal', 'after_meal', 'random'] as const;
export type GlucoseContext = (typeof GLUCOSE_CONTEXTS)[number];

export const MOOD_INFO = [
  { value: 1, label: 'Awful', emoji: '😫', color: '#e5626a' },
  { value: 2, label: 'Low', emoji: '😕', color: '#f0955a' },
  { value: 3, label: 'Okay', emoji: '😐', color: '#e6c34a' },
  { value: 4, label: 'Good', emoji: '🙂', color: '#7ccf7a' },
  { value: 5, label: 'Great', emoji: '😄', color: '#2fbf9b' },
] as const;

export const MOOD_TAGS = [
  'work',
  'family',
  'friends',
  'exercise',
  'sleep',
  'food',
  'weather',
  'health',
  'relationship',
  'study',
  'travel',
  'money',
  'hobbies',
  'nature',
] as const;

export const BREATHING_PATTERNS = {
  box: { label: 'Box breathing', hint: 'Calm and focus', phases: [4, 4, 4, 4] },
  relax: { label: '4-7-8', hint: 'Wind down for sleep', phases: [4, 7, 8, 0] },
  coherent: { label: 'Coherent', hint: 'Balance your heart rate', phases: [5, 0, 5, 0] },
} as const;
export type BreathingPattern = keyof typeof BREATHING_PATTERNS;

export const FAST_PRESETS = [
  { id: '13:11', hours: 13, label: 'Circadian', hint: 'A gentle start' },
  { id: '16:8', hours: 16, label: 'Lean gains', hint: 'The classic' },
  { id: '18:6', hours: 18, label: 'Fat burner', hint: 'A step further' },
  { id: '20:4', hours: 20, label: 'Warrior', hint: 'One big window' },
  { id: '24', hours: 24, label: 'Full day', hint: 'Advanced' },
] as const;

/** Rough metabolic phases during a fast; shown as a timeline, not medical advice. */
export const FASTING_STAGES = [
  { fromHour: 0, name: 'Digesting', hint: 'Blood sugar rises and insulin does its job', emoji: '🍽️' },
  { fromHour: 4, name: 'Blood sugar settles', hint: 'Insulin falls back to baseline', emoji: '📉' },
  { fromHour: 12, name: 'Fat burning', hint: 'Glycogen runs low, the body turns to fat', emoji: '🔥' },
  { fromHour: 16, name: 'Ketosis', hint: 'Ketones start fuelling the brain', emoji: '⚡' },
  { fromHour: 24, name: 'Autophagy', hint: 'Cellular clean-up ramps up', emoji: '♻️' },
] as const;

export const HABIT_COLORS = ['#7c6cf2', '#2fbf9b', '#f0955a', '#3ba7f0', '#e5626a', '#e6c34a', '#c06cf2', '#5fcf5f'] as const;

export const FOOD_CATEGORIES = [
  'grains',
  'protein',
  'dairy',
  'fruit',
  'vegetables',
  'legumes',
  'nuts',
  'snacks',
  'drinks',
  'sweets',
  'meals',
  'fats',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const ACHIEVEMENTS = {
  first_bite: { title: 'First bite', hint: 'Log your first food', emoji: '🥄', tier: 'bronze' },
  full_day: { title: 'Full plate', hint: 'Log breakfast, lunch and dinner on one day', emoji: '🍱', tier: 'bronze' },
  protein_pro: { title: 'Protein pro', hint: 'Hit your protein target on 5 days', emoji: '🥩', tier: 'silver' },
  hydrated: { title: 'Hydrated', hint: 'Reach your water goal', emoji: '💧', tier: 'bronze' },
  hydro_week: { title: 'Hydro hero', hint: 'Reach your water goal 7 days in a row', emoji: '🌊', tier: 'gold' },
  ten_k: { title: '10K club', hint: 'Walk 10,000 steps in a day', emoji: '👟', tier: 'bronze' },
  marathoner: { title: 'Marathoner', hint: 'Walk 250,000 steps in total', emoji: '🏅', tier: 'silver' },
  first_workout: { title: 'Warmed up', hint: 'Log your first workout', emoji: '🏁', tier: 'bronze' },
  ten_workouts: { title: 'Committed', hint: 'Log 10 workouts', emoji: '🏋️', tier: 'silver' },
  fifty_workouts: { title: 'Machine', hint: 'Log 50 workouts', emoji: '🦾', tier: 'gold' },
  weigh_week: { title: 'On the scale', hint: 'Weigh in on 7 different days', emoji: '⚖️', tier: 'bronze' },
  down_two: { title: 'Lighter', hint: 'Trend 2 kg below your first weigh-in', emoji: '🪶', tier: 'silver' },
  dream_sleeper: { title: 'Dream sleeper', hint: 'Sleep 8 hours in a night', emoji: '😴', tier: 'bronze' },
  rested_week: { title: 'Well rested', hint: 'Sleep 7+ hours 7 nights in a row', emoji: '🌙', tier: 'gold' },
  streak_7: { title: 'On a roll', hint: 'Log something 7 days in a row', emoji: '🔥', tier: 'silver' },
  streak_30: { title: 'Unstoppable', hint: 'Log something 30 days in a row', emoji: '☄️', tier: 'gold' },
  mindful_10: { title: 'Zen', hint: 'Complete 10 breathing sessions', emoji: '🪷', tier: 'silver' },
  check_in_7: { title: 'Self aware', hint: 'Check in your mood 7 times', emoji: '🧠', tier: 'bronze' },
  fast_16: { title: 'Fasting focus', hint: 'Complete a 16-hour fast', emoji: '⏳', tier: 'silver' },
  habit_21: { title: 'Habit formed', hint: 'Keep a habit for 21 days straight', emoji: '🌱', tier: 'gold' },
} as const satisfies Record<string, { title: string; hint: string; emoji: string; tier: 'bronze' | 'silver' | 'gold' }>;
export type AchievementCode = keyof typeof ACHIEVEMENTS;
