import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Aurora, Logo } from '../components/Bits';
import { Rings } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { api } from '../lib/api';
import { signIn, signUp } from '../lib/auth-client';
import { queryClient } from '../lib/queries';

const PILLARS = [
  { emoji: '🍽️', label: 'Food & macros' },
  { emoji: '👟', label: 'Steps & workouts' },
  { emoji: '⚖️', label: 'Weight trend' },
  { emoji: '🌙', label: 'Sleep' },
  { emoji: '🧘', label: 'Mood & breathing' },
  { emoji: '💧', label: 'Water' },
  { emoji: '❤️', label: 'Vitals' },
  { emoji: '⏳', label: 'Fasting' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const status = useQuery({ queryKey: ['status'], queryFn: api.status });
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = mode === 'signin' ? await signIn.email({ email, password }) : await signUp.email({ email, password, name: name.trim() || email.split('@')[0]! });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? 'That did not work. Please try again.');
      return;
    }
    queryClient.removeQueries({ queryKey: ['session'] });
    queryClient.removeQueries({ queryKey: ['me'] });
    navigate({ to: mode === 'signup' ? '/welcome' : '/' });
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <Aurora intensity={0.9} />

      <section className="relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="display text-2xl font-semibold">Fettle</span>
        </div>
        <div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="mb-10 animate-float">
            <Rings
              size={260}
              stroke={22}
              gap={7}
              celebrate={false}
              rings={[
                { key: 'a', value: 82, target: 100, color: 'var(--c-energy)' },
                { key: 'b', value: 100, target: 100, color: 'var(--c-move)' },
                { key: 'c', value: 64, target: 100, color: 'var(--c-water)' },
                { key: 'd', value: 90, target: 100, color: 'var(--c-sleep)' },
              ]}
            />
          </motion.div>
          <h1 className="display max-w-lg text-5xl font-semibold leading-[1.05]">
            Get in <span className="text-gradient">fine fettle</span>.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink-2">Food, movement, body, sleep and mind in one calm place, with your data on your own computer.</p>
          <div className="mt-8 flex max-w-lg flex-wrap gap-2">
            {PILLARS.map((p, i) => (
              <motion.span key={p.label} className="chip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                {p.emoji} {p.label}
              </motion.span>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-3">Stored in your local PostgreSQL. Never uploaded, never sold.</p>
      </section>

      <section className="relative flex items-center justify-center p-5">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="card glass w-full max-w-md p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <Logo size={36} />
            <span className="display text-xl font-semibold">Fettle</span>
          </div>
          <h2 className="display text-2xl font-semibold">{mode === 'signin' ? 'Welcome back' : 'Start your journey'}</h2>
          <p className="mt-1 text-sm text-ink-2">{mode === 'signin' ? 'Sign in to pick up where you left off.' : 'Two minutes to set up. Free, private, yours.'}</p>

          {status.data?.signupOpen !== false && (
            <Segmented
              className="mt-6 w-full [&>button]:flex-1"
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              options={[
                { value: 'signin', label: 'Sign in' },
                { value: 'signup', label: 'Create account' },
              ]}
            />
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <Field label="Your name">
                    <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
              <Input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-[color-mix(in_oklab,var(--bad)_12%,transparent)] px-3 py-2 text-sm text-bad">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={busy}>
              {mode === 'signin' ? 'Sign in' : 'Create my account'}
            </Button>
          </form>
        </motion.div>
      </section>
    </div>
  );
}
