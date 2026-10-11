import type {
  AchievementsResponse,
  CopyMealInput,
  DailyPoint,
  DaySummary,
  DoseInput,
  DoseSlot,
  Fast,
  Food,
  FoodEntry,
  FoodEntryInput,
  FoodEntryUpdate,
  FoodInput,
  Habit,
  HabitInput,
  HabitUpdate,
  Me,
  Measurement,
  MeasurementInput,
  Medication,
  MedicationInput,
  MedicationUpdate,
  MindfulInput,
  MindfulSession,
  MoodEntry,
  MoodInput,
  Profile,
  ProfileInput,
  ProfileUpdate,
  SleepEntry,
  SleepInput,
  StartFastInput,
  StepDay,
  StepsInput,
  Vital,
  VitalInput,
  VitalKind,
  WeightEntry,
  WeightInput,
  Workout,
  WorkoutInput,
  WorkoutUpdate,
} from '@fettle/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    try {
      const data = (await response.json()) as { message?: string; error?: string };
      message = data.message ?? message;
      code = data.error;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(response.status, message, code);
  }
  return (await response.json()) as T;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

type Range = { from: string; to: string };
export type FoodHit = Food & { uses: number; lastServings?: number };

export const api = {
  status: () => fetch('/api/status').then((r) => r.json() as Promise<{ signupOpen: boolean }>),

  me: () => request<Me>('GET', '/me'),
  updateMe: (name: string) => request<unknown>('PATCH', '/me', { name }),
  profile: () => request<Profile | null>('GET', '/profile'),
  saveProfile: (input: ProfileInput) => request<Profile>('PUT', '/profile', input),
  updateProfile: (input: ProfileUpdate) => request<Profile>('PATCH', '/profile', input),

  today: (date: string) => request<DaySummary>('GET', `/today${qs({ date })}`),
  daily: ({ from, to }: Range) => request<DailyPoint[]>('GET', `/insights/daily${qs({ from, to })}`),
  achievements: () => request<AchievementsResponse>('GET', '/achievements'),

  searchFoods: (q: string) => request<FoodHit[]>('GET', `/foods/search${qs({ q, limit: 25 })}`),
  frequentFoods: () => request<FoodHit[]>('GET', '/foods/frequent'),
  createFood: (input: FoodInput) => request<Food>('POST', '/foods', input),
  deleteFood: (id: string) => request<unknown>('DELETE', `/foods/${id}`),
  foodEntries: (date: string) => request<FoodEntry[]>('GET', `/food-entries${qs({ date })}`),
  addFoodEntry: (input: FoodEntryInput) => request<FoodEntry>('POST', '/food-entries', input),
  updateFoodEntry: (id: string, input: FoodEntryUpdate) => request<FoodEntry>('PATCH', `/food-entries/${id}`, input),
  deleteFoodEntry: (id: string) => request<FoodEntry>('DELETE', `/food-entries/${id}`),
  copyMeals: (input: CopyMealInput) => request<FoodEntry[]>('POST', '/food-entries/copy', input),
  addWater: (loggedOn: string, amountMl: number) => request<unknown>('POST', '/water', { loggedOn, amountMl }),

  weights: (range?: Partial<Range>) => request<WeightEntry[]>('GET', `/weights${qs({ ...range })}`),
  saveWeight: (input: WeightInput) => request<WeightEntry>('PUT', '/weights', input),
  deleteWeight: (id: string) => request<unknown>('DELETE', `/weights/${id}`),
  measurements: () => request<Measurement[]>('GET', '/measurements'),
  saveMeasurement: (input: MeasurementInput) => request<Measurement>('PUT', '/measurements', input),
  deleteMeasurement: (id: string) => request<unknown>('DELETE', `/measurements/${id}`),

  steps: (range: Range) => request<StepDay[]>('GET', `/steps${qs(range)}`),
  saveSteps: (input: StepsInput) => request<StepDay>('PUT', '/steps', input),
  workouts: (range: Range) => request<Workout[]>('GET', `/workouts${qs(range)}`),
  addWorkout: (input: WorkoutInput) => request<Workout>('POST', '/workouts', input),
  updateWorkout: (id: string, input: WorkoutUpdate) => request<Workout>('PATCH', `/workouts/${id}`, input),
  deleteWorkout: (id: string) => request<unknown>('DELETE', `/workouts/${id}`),

  sleep: (range: Range) => request<SleepEntry[]>('GET', `/sleep${qs(range)}`),
  saveSleep: (input: SleepInput) => request<SleepEntry>('PUT', '/sleep', input),
  deleteSleep: (id: string) => request<unknown>('DELETE', `/sleep/${id}`),

  moods: (range: Range) => request<MoodEntry[]>('GET', `/moods${qs(range)}`),
  addMood: (input: MoodInput) => request<MoodEntry>('POST', '/moods', input),
  deleteMood: (id: string) => request<unknown>('DELETE', `/moods/${id}`),
  mindful: (range: Range) => request<MindfulSession[]>('GET', `/mindful${qs(range)}`),
  addMindful: (input: MindfulInput) => request<MindfulSession>('POST', '/mindful', input),

  vitals: (range: Range & { kind?: VitalKind }) => request<Vital[]>('GET', `/vitals${qs(range)}`),
  addVital: (input: VitalInput) => request<Vital>('POST', '/vitals', input),
  deleteVital: (id: string) => request<unknown>('DELETE', `/vitals/${id}`),

  habits: (range: Range & { today: string }) => request<Habit[]>('GET', `/habits${qs(range)}`),
  addHabit: (input: HabitInput) => request<{ id: string }>('POST', '/habits', input),
  updateHabit: (id: string, input: HabitUpdate) => request<unknown>('PATCH', `/habits/${id}`, input),
  deleteHabit: (id: string) => request<unknown>('DELETE', `/habits/${id}`),
  checkin: (id: string, day: string, count: number) => request<unknown>('PUT', `/habits/${id}/checkins/${day}`, { count }),

  medications: () => request<Medication[]>('GET', '/medications'),
  doses: (date: string) => request<DoseSlot[]>('GET', `/medications/doses${qs({ date })}`),
  addMedication: (input: MedicationInput) => request<Medication>('POST', '/medications', input),
  updateMedication: (id: string, input: MedicationUpdate) => request<Medication>('PATCH', `/medications/${id}`, input),
  deleteMedication: (id: string) => request<unknown>('DELETE', `/medications/${id}`),
  setDose: (id: string, input: DoseInput) => request<unknown>('PUT', `/medications/${id}/doses`, input),

  fasts: () => request<{ active: Fast | null; history: Fast[] }>('GET', '/fasts'),
  startFast: (input: StartFastInput) => request<Fast>('POST', '/fasts', input),
  endFast: (id: string) => request<Fast>('POST', `/fasts/${id}/end`, {}),
  deleteFast: (id: string) => request<unknown>('DELETE', `/fasts/${id}`),

  exportUrl: '/api/v1/export',
};
