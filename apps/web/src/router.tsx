import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from './components/AppShell';
import { api } from './lib/api';
import { authClient } from './lib/auth-client';
import { queryClient } from './lib/queries';
import { ActivityPage } from './pages/ActivityPage';
import { BodyPage } from './pages/BodyPage';
import { FastingPage } from './pages/FastingPage';
import { HabitsPage } from './pages/HabitsPage';
import { InsightsPage } from './pages/InsightsPage';
import { LoginPage } from './pages/LoginPage';
import { MedsPage } from './pages/MedsPage';
import { MindPage } from './pages/MindPage';
import { NutritionPage } from './pages/NutritionPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';
import { SleepPage } from './pages/SleepPage';
import { TodayPage } from './pages/TodayPage';
import { VitalsPage } from './pages/VitalsPage';

/** Session lookup that waits out a cold start (API still booting) instead of treating it as signed out. */
const getSession = () =>
  queryClient.fetchQuery({
    queryKey: ['session'],
    queryFn: async () => {
      for (let attempt = 0; ; attempt++) {
        const { data, error } = await authClient.getSession();
        const serverDown = error && (!error.status || error.status >= 500);
        if (!serverDown || attempt >= 30) return data ?? null;
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
    staleTime: 60_000,
  });

const getMe = () => queryClient.fetchQuery({ queryKey: ['me'], queryFn: api.me, staleTime: 60_000 });

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: '/login' });
  },
  component: OnboardingPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async () => {
    if (!(await getSession())) throw redirect({ to: '/login' });
    const me = await getMe();
    if (!me.onboarded) throw redirect({ to: '/welcome' });
  },
  component: AppShell,
});

const page = <TPath extends string>(path: TPath, component: () => React.ReactNode) => createRoute({ getParentRoute: () => appRoute, path, component });

const routeTree = rootRoute.addChildren([
  loginRoute,
  onboardingRoute,
  appRoute.addChildren([
    page('/', TodayPage),
    page('/nutrition', NutritionPage),
    page('/activity', ActivityPage),
    page('/body', BodyPage),
    page('/sleep', SleepPage),
    page('/mind', MindPage),
    page('/vitals', VitalsPage),
    page('/habits', HabitsPage),
    page('/meds', MedsPage),
    page('/fasting', FastingPage),
    page('/insights', InsightsPage),
    page('/settings', SettingsPage),
  ]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
