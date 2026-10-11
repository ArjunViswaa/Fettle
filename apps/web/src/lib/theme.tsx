import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'fettle-theme';

interface ThemeState {
  preference: ThemePreference;
  resolved: Resolved;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function applyAttribute(p: ThemePreference) {
  const root = document.documentElement;
  if (p === 'system') delete root.dataset.theme;
  else root.dataset.theme = p;
}

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStored);
  const [systemDark, setSystemDark] = useState(() => !window.matchMedia('(prefers-color-scheme: light)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemDark(!mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: Resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    applyAttribute(preference);
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // storage unavailable; the choice just won't persist
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#070b10' : '#f3f6f8');
  }, [preference, resolved]);

  // Apply the attribute before React re-renders, so components that read CSS variables
  // during render (charts) already see the new theme's values.
  const choose = useCallback((p: ThemePreference) => {
    applyAttribute(p);
    setPreference(p);
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference: choose }), [preference, resolved, choose]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
