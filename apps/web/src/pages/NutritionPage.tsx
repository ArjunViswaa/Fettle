import { AnimatePresence, motion } from 'motion/react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { addDays, MEAL_INFO, MEALS, todayISO, type FoodEntry, type Meal, type Profile } from '@fettle/shared';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DayNav, PageHeader } from '../components/Bits';
import { Card, EmptyState } from '../components/Card';
import { Chart, dayAxes, tooltipBase, type ChartTheme } from '../components/charts/Chart';
import { ProgressRing } from '../components/Rings';
import { Button } from '../components/ui/Button';
import { useUi } from '../components/UiProvider';
import { api } from '../lib/api';
import { refreshHealthData, useDaily, useFoodEntries, useHealthMutation, useProfile, useToday } from '../lib/queries';
import { fmt } from '../lib/utils';

export function NutritionPage() {
  const { day, setDay, open } = useUi();
  const { data: profile } = useProfile();
  const { data: summary } = useToday(day);
  const { data: entries } = useFoodEntries(day);

  const copy = useHealthMutation((meal?: Meal) => api.copyMeals({ fromDate: addDays(day, -1), toDate: day, meal }), {
    success: (rows) => `Copied ${rows.length} item${rows.length === 1 ? '' : 's'} from the day before`,
  });

  if (!profile) return null;
  const n = summary?.nutrition;

  return (
    <div>
      <PageHeader
        title="Food"
        emoji="🍽️"
        subtitle="Log what you eat; Fettle does the maths."
        actions={
          <>
            <DayNav day={day} onChange={setDay} />
            <Button variant="primary" onClick={() => open({ kind: 'food' })}>
              <Plus className="size-4" /> Add food
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5" bodyClassName="flex items-center gap-6">
          <ProgressRing value={n?.calories ?? 0} target={profile.calorieTarget} color="var(--c-energy)" size={150} stroke={14}>
            <AnimatedNumber value={Math.round(n?.calories ?? 0)} format={(v) => fmt(v)} className="display num text-3xl font-semibold" />
            <span className="text-xs text-ink-3">of {fmt(profile.calorieTarget)}</span>
          </ProgressRing>
          <div className="flex-1 space-y-2.5 text-sm">
            <MacroLine label="Protein" value={n?.proteinG ?? 0} target={profile.proteinTargetG} color="var(--c-protein)" />
            <MacroLine label="Carbs" value={n?.carbsG ?? 0} target={profile.carbsTargetG} color="var(--c-carbs)" />
            <MacroLine label="Fat" value={n?.fatG ?? 0} target={profile.fatTargetG} color="var(--c-fat)" />
          </div>
        </Card>

        <Card className="lg:col-span-3" title="Macro split" delay={0.05}>
          <MacroDonut protein={n?.proteinG ?? 0} carbs={n?.carbsG ?? 0} fat={n?.fatG ?? 0} />
        </Card>

        <Card className="lg:col-span-4" title="Also worth watching" delay={0.08}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Micro label="Fibre" value={n?.fiberG ?? 0} unit="g" target={profile.fiberTargetG} good="above" />
            <Micro label="Sugar" value={n?.sugarG ?? 0} unit="g" target={50} good="below" />
            <Micro label="Sodium" value={n?.sodiumMg ?? 0} unit="mg" target={2300} good="below" />
          </div>
          <p className="mt-3 text-xs text-ink-3">Sugar and sodium limits follow WHO guidance (under 50 g sugar, 2,300 mg sodium).</p>
        </Card>

        <div className="space-y-4 lg:col-span-7">
          {MEALS.map((meal, i) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={entries?.filter((e) => e.meal === meal) ?? []}
              target={Math.round(profile.calorieTarget * MEAL_INFO[meal].share)}
              delay={0.05 * i}
              onAdd={() => open({ kind: 'food', meal })}
              onCopy={() => copy.mutate(meal)}
            />
          ))}
          {entries?.length === 0 && (
            <Button variant="secondary" className="w-full justify-center" onClick={() => copy.mutate(undefined)} loading={copy.isPending}>
              <Copy className="size-4" /> Copy everything from the day before
            </Button>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <TrendCard profile={profile} />
        </div>
      </div>
    </div>
  );
}

function MacroLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const ratio = target ? Math.min(value / target, 1) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-ink-2">{label}</span>
        <span className="num">
          <b>{fmt(value)}</b>
          <span className="text-ink-3">/{target}g</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${ratio * 100}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      </div>
    </div>
  );
}

function Micro({ label, value, unit, target, good }: { label: string; value: number; unit: string; target: number; good: 'above' | 'below' }) {
  const ok = good === 'above' ? value >= target : value <= target;
  return (
    <div className="rounded-2xl bg-surface-2/70 py-3">
      <div className="num font-semibold" style={{ color: value === 0 ? undefined : ok ? 'var(--good)' : 'var(--warn)' }}>
        {fmt(value)}
        <span className="text-xs font-normal text-ink-3">{unit}</span>
      </div>
      <div className="text-[11px] text-ink-3">
        {label} · {good === 'above' ? '≥' : '≤'}
        {fmt(target)}
      </div>
    </div>
  );
}

function MacroDonut({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const kcal = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (!total) return <EmptyState icon="🥧" title="Nothing logged yet" />;
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'item', valueFormatter: (v: number) => `${fmt(v)} kcal` },
    series: [
      {
        type: 'pie',
        radius: ['58%', '88%'],
        padAngle: 3,
        itemStyle: { borderRadius: 8 },
        label: { show: false },
        data: [
          { name: 'Protein', value: Math.round(kcal.protein), itemStyle: { color: t.c('protein') } },
          { name: 'Carbs', value: Math.round(kcal.carbs), itemStyle: { color: t.c('carbs') } },
          { name: 'Fat', value: Math.round(kcal.fat), itemStyle: { color: t.c('fat') } },
        ],
      },
    ],
  });
  return (
    <div>
      <Chart option={option} height={130} ariaLabel="Share of calories from protein, carbs and fat" />
      <div className="mt-2 flex justify-center gap-3 text-xs">
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <span key={k} className="flex items-center gap-1 capitalize text-ink-2">
            <span className="size-2 rounded-full" style={{ background: `var(--c-${k})` }} />
            {Math.round((kcal[k] / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function MealSection({ meal, entries, target, delay, onAdd, onCopy }: { meal: Meal; entries: FoodEntry[]; target: number; delay: number; onAdd: () => void; onCopy: () => void }) {
  const total = entries.reduce((a, e) => a + e.calories, 0);
  const remove = useHealthMutation((entry: FoodEntry) => api.deleteFoodEntry(entry.id), {
    onSuccess: (entry) =>
      toast(`Removed ${entry.name}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            api
              .addFoodEntry(
                entry.foodId
                  ? { loggedOn: entry.loggedOn, meal: entry.meal, foodId: entry.foodId, servings: entry.servings }
                  : { loggedOn: entry.loggedOn, meal: entry.meal, quick: { name: entry.name, calories: entry.calories, proteinG: entry.proteinG, carbsG: entry.carbsG, fatG: entry.fatG } },
              )
              .then(refreshHealthData),
        },
      }),
  });
  const resize = useHealthMutation(({ id, servings }: { id: string; servings: number }) => api.updateFoodEntry(id, { servings }));

  return (
    <Card
      delay={delay}
      title={
        <span className="flex items-center gap-2">
          {MEAL_INFO[meal].emoji} {MEAL_INFO[meal].label}
        </span>
      }
      subtitle={`${fmt(total)} kcal · suggested ~${fmt(target)}`}
      action={
        <div className="flex gap-1">
          <button onClick={onCopy} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-ink" title="Copy from the day before" aria-label="Copy from the day before">
            <Copy className="size-4" />
          </button>
          <button onClick={onAdd} className="rounded-lg p-2 text-ink-3 hover:bg-surface-2 hover:text-energy" aria-label={`Add to ${meal}`}>
            <Plus className="size-4" />
          </button>
        </div>
      }
      bodyClassName="pt-2"
    >
      {entries.length === 0 ? (
        <button onClick={onAdd} className="w-full rounded-2xl border border-dashed border-line py-4 text-sm text-ink-3 hover:border-line-strong hover:text-ink-2">
          + Add {MEAL_INFO[meal].label.toLowerCase()}
        </button>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          <AnimatePresence initial={false}>
            {entries.map((e) => (
              <motion.li key={e.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, x: 40 }} className="group flex items-center gap-3 py-2.5">
                <span className="text-xl">{e.emoji ?? '🍴'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-ink-3">
                    {e.servingUnit ? `${fmt(e.servings, 2)} × ${fmt(e.servingSize ?? 1, 2)} ${e.servingUnit}` : 'Quick add'} · P {fmt(e.proteinG)} C {fmt(e.carbsG)} F {fmt(e.fatG)}
                  </div>
                </div>
                {e.foodId && (
                  <select
                    aria-label="Servings"
                    value={e.servings}
                    onChange={(ev) => resize.mutate({ id: e.id, servings: Number(ev.target.value) })}
                    className="h-8 rounded-lg border border-line bg-surface-2 px-1.5 text-xs"
                  >
                    {[...new Set([0.5, 1, 1.5, 2, 2.5, 3, 4, e.servings])].sort((a, b) => a - b).map((s) => (
                      <option key={s} value={s}>
                        ×{s}
                      </option>
                    ))}
                  </select>
                )}
                <span className="num w-14 text-right text-sm font-semibold">{fmt(e.calories)}</span>
                <button onClick={() => remove.mutate(e)} className="rounded-lg p-1.5 text-ink-3 opacity-60 hover:text-bad group-hover:opacity-100" aria-label={`Remove ${e.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function TrendCard({ profile }: { profile: Profile }) {
  const { data } = useDaily(14, todayISO());
  const option = (t: ChartTheme) => ({
    tooltip: { ...tooltipBase(t), trigger: 'axis', valueFormatter: (v: number) => `${fmt(v ?? 0)} g` },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8, textStyle: { color: t.text2, fontSize: 11 } },
    grid: { left: 8, right: 8, top: 12, bottom: 30, containLabel: true },
    ...dayAxes(t, data?.map((d) => d.day) ?? []),
    series: (['protein', 'carbs', 'fat'] as const).map((k) => ({
      type: 'bar',
      stack: 'macros',
      name: k[0]!.toUpperCase() + k.slice(1),
      data: data?.map((d) => Math.round((k === 'protein' ? d.proteinG : k === 'carbs' ? d.carbsG : d.fatG) ?? 0)),
      itemStyle: { color: t.c(k), borderRadius: k === 'fat' ? [6, 6, 0, 0] : 0 },
      barWidth: '52%',
    })),
  });
  const logged = data?.filter((d) => d.calories) ?? [];
  const avg = logged.length ? logged.reduce((a, d) => a + (d.calories ?? 0), 0) / logged.length : 0;
  return (
    <Card title="Last 14 days" subtitle={logged.length ? `Averaging ${fmt(avg)} kcal on ${logged.length} logged days (goal ${fmt(profile.calorieTarget)})` : 'Your macro history appears here'} delay={0.1}>
      {data ? <Chart option={option} height={260} ariaLabel="Grams of protein, carbs and fat per day for two weeks" /> : <div className="skeleton h-[260px]" />}
    </Card>
  );
}
