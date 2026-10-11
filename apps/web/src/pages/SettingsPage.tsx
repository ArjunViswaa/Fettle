import { useNavigate } from '@tanstack/react-router';
import { Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ACTIVITY_INFO,
  ACTIVITY_LEVELS,
  ageOn,
  GOAL_INFO,
  GOALS,
  kgToDisplay,
  suggestTargets,
  todayISO,
  weightUnit,
  type Profile,
  type ProfileUpdate,
} from '@fettle/shared';
import { PageHeader } from '../components/Bits';
import { Card } from '../components/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';
import { queryClient, refreshHealthData, useMe, useProfile } from '../lib/queries';
import { HeightInput, WeightInput } from './OnboardingPage';

export function SettingsPage() {
  const { data: profile } = useProfile();
  const { data: me } = useMe();
  if (!profile || !me) return null;
  return (
    <div>
      <PageHeader title="Settings" emoji="⚙️" subtitle="Your profile, daily targets and data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard profile={profile} name={me.name} key={profile.unitSystem} />
        <TargetsCard profile={profile} />
        <DataCard email={me.email} />
      </div>
    </div>
  );
}

async function saveProfile(update: ProfileUpdate, message = 'Saved') {
  try {
    const profile = await api.updateProfile(update);
    queryClient.setQueryData(['profile'], profile);
    await refreshHealthData();
    toast.success(message);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

function ProfileCard({ profile, name: initialName }: { profile: Profile; name: string }) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(profile);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    if (name.trim() && name !== initialName) {
      await api.updateMe(name.trim());
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    }
    await saveProfile({
      sex: draft.sex,
      birthDate: draft.birthDate,
      heightCm: draft.heightCm,
      activityLevel: draft.activityLevel,
      goal: draft.goal,
      targetWeightKg: draft.goal === 'maintain' ? null : draft.targetWeightKg,
      weeklyRateKg: draft.weeklyRateKg,
      unitSystem: draft.unitSystem,
    }, 'Profile saved');
    setBusy(false);
  };

  return (
    <Card title="Profile" subtitle="Used for calorie and target suggestions">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Units">
            <Segmented className="w-full [&>button]:flex-1" value={draft.unitSystem} onChange={(v) => set('unitSystem', v)} options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} />
          </Field>
          <Field label="Sex">
            <Select value={draft.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          </Field>
          <Field label="Date of birth" hint={`${ageOn(draft.birthDate, todayISO())} years`}>
            <Input type="date" value={draft.birthDate} max={todayISO()} onChange={(e) => set('birthDate', e.target.value)} />
          </Field>
        </div>
        <HeightInput units={draft.unitSystem} cm={draft.heightCm} onChange={(v) => set('heightCm', v)} />
        <Field label="Activity level">
          <Select value={draft.activityLevel} onChange={(e) => set('activityLevel', e.target.value as Profile['activityLevel'])}>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_INFO[a].label}: {ACTIVITY_INFO[a].hint}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Goal">
          <Segmented className="w-full [&>button]:flex-1" value={draft.goal} onChange={(v) => set('goal', v)} options={GOALS.map((g) => ({ value: g, label: `${GOAL_INFO[g].emoji} ${GOAL_INFO[g].label}` }))} />
        </Field>
        {draft.goal !== 'maintain' && (
          <div className="grid grid-cols-2 gap-3">
            <WeightInput units={draft.unitSystem} kg={draft.targetWeightKg ?? draft.latestWeightKg ?? 70} onChange={(v) => set('targetWeightKg', v)} label="Target weight" />
            <Field label={`Pace (${weightUnit(draft.unitSystem)} / week)`}>
              <Input
                type="number"
                step="0.05"
                min={0}
                max={1.5}
                value={kgToDisplay(draft.weeklyRateKg, draft.unitSystem)}
                onChange={(e) => set('weeklyRateKg', draft.unitSystem === 'imperial' ? Number(e.target.value) * 0.4536 : Number(e.target.value))}
              />
            </Field>
          </div>
        )}
        <Button variant="primary" onClick={save} loading={busy}>
          Save profile
        </Button>
      </div>
    </Card>
  );
}

const TARGETS: Array<{ key: keyof Profile; label: string; unit: string }> = [
  { key: 'calorieTarget', label: 'Calories', unit: 'kcal' },
  { key: 'proteinTargetG', label: 'Protein', unit: 'g' },
  { key: 'carbsTargetG', label: 'Carbs', unit: 'g' },
  { key: 'fatTargetG', label: 'Fat', unit: 'g' },
  { key: 'fiberTargetG', label: 'Fibre', unit: 'g' },
  { key: 'waterTargetMl', label: 'Water', unit: 'ml' },
  { key: 'stepTarget', label: 'Steps', unit: '' },
  { key: 'activeMinutesTarget', label: 'Active time', unit: 'min' },
  { key: 'sleepTargetMinutes', label: 'Sleep', unit: 'min' },
];

function TargetsCard({ profile }: { profile: Profile }) {
  const [values, setValues] = useState(() => Object.fromEntries(TARGETS.map((t) => [t.key, String(profile[t.key])])));
  const [busy, setBusy] = useState(false);

  const recalc = () => {
    const t = suggestTargets({
      sex: profile.sex,
      weightKg: profile.latestWeightKg ?? 70,
      heightCm: profile.heightCm,
      age: profile.age,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
      weeklyRateKg: profile.goal === 'maintain' ? 0 : profile.weeklyRateKg,
    });
    setValues({
      calorieTarget: String(t.calories),
      proteinTargetG: String(t.proteinG),
      carbsTargetG: String(t.carbsG),
      fatTargetG: String(t.fatG),
      fiberTargetG: String(t.fiberG),
      waterTargetMl: String(t.waterMl),
      stepTarget: String(t.steps),
      activeMinutesTarget: String(t.activeMinutes),
      sleepTargetMinutes: String(t.sleepMinutes),
    });
    toast('Suggested targets filled in from your latest weight. Save to apply.');
  };

  const save = async () => {
    setBusy(true);
    await saveProfile(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Math.round(Number(v))])) as ProfileUpdate, 'Targets updated');
    setBusy(false);
  };

  return (
    <Card title="Daily targets" subtitle="What your rings and bars fill towards" action={<Button size="sm" variant="ghost" onClick={recalc}><RefreshCw className="size-3.5" /> Suggest</Button>}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TARGETS.map((t) => (
          <Field key={t.key} label={`${t.label}${t.unit ? ` (${t.unit})` : ''}`}>
            <Input type="number" min={0} value={values[t.key]} onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <Button variant="primary" className="mt-4" onClick={save} loading={busy}>
        Save targets
      </Button>
    </Card>
  );
}

function DataCard({ email }: { email: string }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const deleteAccount = async () => {
    setBusy(true);
    const { error } = await authClient.deleteUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? 'Could not delete the account');
      return;
    }
    queryClient.clear();
    navigate({ to: '/login' });
  };

  return (
    <Card className="lg:col-span-2" title="Your data">
      <div className="flex items-start gap-3 rounded-2xl bg-surface-2/70 p-4 text-sm text-ink-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-good" />
        <p>
          Everything you log lives in the PostgreSQL database on this computer. Fettle has no cloud, no analytics and no third-party trackers, and your data is never part of the code repository.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={api.exportUrl} download className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-sm font-medium hover:bg-surface-3">
          <Download className="size-4" /> Export everything (JSON)
        </a>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Delete account
        </Button>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm} title="Delete your account?" description={`This permanently erases ${email} and every entry you've logged. It cannot be undone. Export first if you want a copy.`} icon="⚠️">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            deleteAccount();
          }}
          className="space-y-4"
        >
          <Field label="Your password, to confirm">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" size="lg" className="w-full justify-center" loading={busy}>
            Delete everything
          </Button>
        </form>
      </Dialog>
    </Card>
  );
}
