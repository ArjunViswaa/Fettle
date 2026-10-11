import { keepPreviousData, QueryClient, useMutation, useQuery, type MutationFunction } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addDays, todayISO, type UnitSystem } from '@fettle/shared';
import { api, ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** Queries that don't change when health data is logged. */
const STABLE_KEYS = new Set(['session', 'me', 'profile', 'food-search']);

/**
 * After any log, refresh everything health-related (it's all small and per-user), including
 * achievements, whose response tells the shell to celebrate anything newly unlocked.
 */
export function refreshHealthData() {
  return queryClient.invalidateQueries({ predicate: (q) => !STABLE_KEYS.has(String(q.queryKey[0])) });
}

/** A mutation that refreshes the app afterwards and reports failures as a toast. */
export function useHealthMutation<TData, TVars = void>(
  fn: MutationFunction<TData, TVars>,
  opts: { success?: string | ((data: TData, vars: TVars) => string | undefined); onSuccess?: (data: TData, vars: TVars) => void } = {},
) {
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      opts.onSuccess?.(data, vars);
      const message = typeof opts.success === 'function' ? opts.success(data, vars) : opts.success;
      if (message) toast.success(message);
      await refreshHealthData();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Something went wrong'),
  });
}

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: api.me });
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: api.profile, staleTime: 5 * 60_000 });

export function useUnits(): UnitSystem {
  return useProfile().data?.unitSystem ?? 'metric';
}

export const useToday = (date: string) =>
  useQuery({ queryKey: ['today', date], queryFn: () => api.today(date), placeholderData: keepPreviousData });

/** The last `days` days ending on `end` (inclusive). */
export function rangeEnding(end: string, days: number) {
  return { from: addDays(end, -(days - 1)), to: end };
}

export const useDaily = (days: number, end = todayISO()) => {
  const range = rangeEnding(end, days);
  return useQuery({ queryKey: ['daily', range.from, range.to], queryFn: () => api.daily(range), placeholderData: keepPreviousData });
};

export const useAchievements = () => useQuery({ queryKey: ['achievements'], queryFn: api.achievements, staleTime: 0 });

export const useFoodEntries = (date: string) =>
  useQuery({ queryKey: ['food-entries', date], queryFn: () => api.foodEntries(date), placeholderData: keepPreviousData });

export const useFoodSearch = (q: string) =>
  useQuery({ queryKey: ['food-search', q], queryFn: () => api.searchFoods(q), placeholderData: keepPreviousData, staleTime: 60_000 });

export const useFrequentFoods = () => useQuery({ queryKey: ['frequent-foods'], queryFn: api.frequentFoods });

export const useWeights = () => useQuery({ queryKey: ['weights'], queryFn: () => api.weights() });
export const useMeasurements = () => useQuery({ queryKey: ['measurements'], queryFn: api.measurements });

export const useWorkouts = (days: number) => {
  const range = rangeEnding(todayISO(), days);
  return useQuery({ queryKey: ['workouts', range.from], queryFn: () => api.workouts(range) });
};

export const useSleep = (days: number) => {
  const range = rangeEnding(todayISO(), days);
  return useQuery({ queryKey: ['sleep', range.from], queryFn: () => api.sleep(range) });
};

export const useMoods = (days: number) => {
  const range = rangeEnding(todayISO(), days);
  return useQuery({ queryKey: ['moods', range.from], queryFn: () => api.moods(range) });
};

export const useMindful = (days: number) => {
  const range = rangeEnding(todayISO(), days);
  return useQuery({ queryKey: ['mindful', range.from], queryFn: () => api.mindful(range) });
};

export const useVitals = (days: number) => {
  const range = rangeEnding(todayISO(), days);
  return useQuery({ queryKey: ['vitals', range.from], queryFn: () => api.vitals(range) });
};

export const useHabits = (days: number) => {
  const today = todayISO();
  const range = rangeEnding(today, days);
  return useQuery({ queryKey: ['habits', range.from, today], queryFn: () => api.habits({ ...range, today }) });
};

export const useMedications = () => useQuery({ queryKey: ['medications'], queryFn: api.medications });
export const useDoses = (date: string) => useQuery({ queryKey: ['doses', date], queryFn: () => api.doses(date) });
export const useFasts = () => useQuery({ queryKey: ['fasts'], queryFn: api.fasts });
