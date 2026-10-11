import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Apple,
  BarChart3,
  Brain,
  CalendarCheck,
  HeartPulse,
  Home,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Pill,
  Plus,
  Scale,
  Settings,
  Sun,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ACHIEVEMENTS } from '@fettle/shared';
import { signOut } from '../lib/auth-client';
import { celebrate } from '../lib/celebrate';
import { queryClient, useAchievements, useMe } from '../lib/queries';
import { useTheme, type ThemePreference } from '../lib/theme';
import { cn } from '../lib/utils';
import { Logo } from './Bits';
import { Dialog } from './ui/Dialog';
import { UiProvider, useUi } from './UiProvider';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const NAV_GROUPS: Array<{ title?: string; items: NavItem[] }> = [
  { items: [{ to: '/', label: 'Today', icon: Home, color: 'var(--brand)' }] },
  {
    title: 'Track',
    items: [
      { to: '/nutrition', label: 'Food', icon: Apple, color: 'var(--c-energy)' },
      { to: '/activity', label: 'Activity', icon: Activity, color: 'var(--c-move)' },
      { to: '/body', label: 'Body', icon: Scale, color: 'var(--c-weight)' },
      { to: '/sleep', label: 'Sleep', icon: Moon, color: 'var(--c-sleep)' },
      { to: '/mind', label: 'Mind', icon: Brain, color: 'var(--c-mind)' },
      { to: '/vitals', label: 'Vitals', icon: HeartPulse, color: 'var(--c-heart)' },
    ],
  },
  {
    title: 'Routine',
    items: [
      { to: '/habits', label: 'Habits', icon: CalendarCheck, color: 'var(--c-active)' },
      { to: '/meds', label: 'Medication', icon: Pill, color: 'var(--c-water)' },
      { to: '/fasting', label: 'Fasting', icon: Timer, color: 'var(--c-energy)' },
    ],
  },
  {
    title: 'Review',
    items: [
      { to: '/insights', label: 'Insights', icon: BarChart3, color: 'var(--brand-3)' },
      { to: '/settings', label: 'Settings', icon: Settings, color: 'var(--text-2)' },
    ],
  },
];
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export function AppShell() {
  return (
    <UiProvider>
      <div className="relative min-h-screen">
        <Sidebar />
        <div className="lg:pl-[256px]">
          <MobileTopBar />
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8">
            <PageTransition />
          </main>
        </div>
        <MobileNav />
        <AchievementWatcher />
      </div>
    </UiProvider>
  );
}

function PageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function useActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
}

function Sidebar() {
  const isActive = useActive();
  const { open } = useUi();
  return (
    <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-[256px] flex-col border-r border-line px-4 py-5 lg:flex">
      <Link to="/" className="mb-6 flex items-center gap-2.5 px-2">
        <Logo />
        <span className="display text-xl font-semibold tracking-tight">Fettle</span>
      </Link>

      <button
        onClick={() => open({ kind: 'menu' })}
        className="brand-gradient mb-5 flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-[var(--brand-ink)] shadow-[0_12px_30px_-14px_var(--brand)] transition hover:brightness-110 active:scale-[0.98]"
      >
        <Plus className="size-4" strokeWidth={2.5} /> Log something
        <kbd className="ml-1 rounded-md bg-black/15 px-1.5 text-[10px] font-medium">L</kbd>
      </button>

      <nav className="-mx-1 flex flex-1 flex-col gap-4 overflow-y-auto px-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.title && <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">{group.title}</div>}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl border border-line bg-surface-2"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <item.icon className="relative size-[18px]" style={active ? { color: item.color } : undefined} />
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-3">
        <ThemeSwitch />
        <UserCard />
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const isActive = useActive();
  const current = ALL_NAV.find((n) => isActive(n.to));
  return (
    <header className="glass sticky top-0 z-20 border-b border-line lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="display font-semibold">Fettle</span>
        </Link>
        <span className="text-sm text-ink-3">{current?.label}</span>
      </div>
    </header>
  );
}

function MobileNav() {
  const isActive = useActive();
  const { open } = useUi();
  const [more, setMore] = useState(false);
  const main = [ALL_NAV[0]!, ALL_NAV[1]!, ALL_NAV[2]!];
  return (
    <>
      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[22px] border border-line px-2 py-2 shadow-2xl lg:hidden">
        {main.slice(0, 2).map((item) => (
          <MobileNavItem key={item.to} {...item} active={isActive(item.to)} />
        ))}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => open({ kind: 'menu' })}
          aria-label="Log something"
          className="brand-gradient -mt-8 flex size-14 shrink-0 items-center justify-center rounded-[20px] text-[var(--brand-ink)] shadow-[0_12px_30px_-8px_var(--brand)]"
        >
          <Plus className="size-6" strokeWidth={2.6} />
        </motion.button>
        <MobileNavItem {...main[2]!} active={isActive(main[2]!.to)} />
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-ink-3">
          <LayoutGrid className="size-5" />
          More
        </button>
      </nav>
      <Dialog open={more} onOpenChange={setMore} title="Everything in Fettle">
        <div className="grid grid-cols-3 gap-2">
          {ALL_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMore(false)}
              className={cn('flex flex-col items-center gap-2 rounded-2xl border border-line py-4 text-xs font-medium', isActive(item.to) ? 'bg-surface-2 text-ink' : 'text-ink-2')}
            >
              <item.icon className="size-6" style={{ color: item.color }} />
              {item.label}
            </Link>
          ))}
        </div>
        <div className="mt-4">
          <ThemeSwitch />
        </div>
      </Dialog>
    </>
  );
}

function MobileNavItem({ to, label, icon: Icon, active, color }: NavItem & { active: boolean }) {
  return (
    <Link to={to} className={cn('flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium', active ? 'text-ink' : 'text-ink-3')}>
      <Icon className="size-5" style={active ? { color } : undefined} />
      {label}
    </Link>
  );
}

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  const options: Array<{ value: ThemePreference; icon: LucideIcon; label: string }> = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];
  return (
    <div className="flex rounded-xl border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={preference === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setPreference(o.value)}
          className={cn('relative flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors', preference === o.value ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
        >
          {preference === o.value && (
            <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-lg bg-surface ring-1 ring-line" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
          )}
          <o.icon className="relative size-4" />
        </button>
      ))}
    </div>
  );
}

function UserCard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const initials = (me?.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="brand-gradient flex size-9 items-center justify-center rounded-xl text-sm font-bold text-[var(--brand-ink)]">{initials}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{me?.name}</div>
        <div className="truncate text-xs text-ink-3">{me?.email}</div>
      </div>
      <button
        aria-label="Sign out"
        title="Sign out"
        className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
        onClick={async () => {
          await signOut();
          queryClient.clear();
          navigate({ to: '/login' });
        }}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

/** Listens to the achievements query (refreshed after every log) and throws a party for new badges. */
function AchievementWatcher() {
  const { data } = useAchievements();
  useEffect(() => {
    if (!data?.newlyUnlocked.length) return;
    celebrate();
    for (const code of data.newlyUnlocked) {
      const a = ACHIEVEMENTS[code];
      toast(`${a.emoji}  Badge unlocked: ${a.title}`, { description: a.hint, duration: 6000 });
    }
  }, [data]);
  return null;
}
