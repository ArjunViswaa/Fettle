import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Search, Sparkles, Trash2 } from 'lucide-react';
import { useDeferredValue, useEffect, useState, type FormEvent } from 'react';
import { MEAL_INFO, MEALS, type Food, type Meal } from '@fettle/shared';
import { api, type FoodHit } from '../lib/api';
import { useFoodSearch, useFrequentFoods, useHealthMutation } from '../lib/queries';
import { cn, fmt } from '../lib/utils';
import { AnimatedNumber } from './AnimatedNumber';
import { Stepper } from './Bits';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, Input } from './ui/Field';
import { Segmented } from './ui/Segmented';

type Tab = 'search' | 'quick' | 'create';

export function mealForNow(date = new Date()): Meal {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

export function FoodDialog({ open, onOpenChange, day, meal: initialMeal }: { open: boolean; onOpenChange: (o: boolean) => void; day: string; meal?: Meal }) {
  const [tab, setTab] = useState<Tab>('search');
  const [meal, setMeal] = useState<Meal>(initialMeal ?? mealForNow());
  const [selected, setSelected] = useState<Food | null>(null);

  useEffect(() => {
    if (open) {
      setTab('search');
      setSelected(null);
      setMeal(initialMeal ?? mealForNow());
    }
  }, [open, initialMeal]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add food" description={`${MEAL_INFO[meal].emoji} ${MEAL_INFO[meal].label}`} icon="🍽️" className="sm:max-w-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={(t) => {
            setTab(t);
            setSelected(null);
          }}
          options={[
            { value: 'search', label: 'Search' },
            { value: 'quick', label: 'Quick add' },
            { value: 'create', label: 'New food' },
          ]}
        />
        <Segmented size="sm" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_INFO[m].emoji }))} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected ? 'detail' : tab} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
          {selected ? (
            <FoodDetail food={selected} meal={meal} day={day} onBack={() => setSelected(null)} onDone={() => onOpenChange(false)} />
          ) : tab === 'search' ? (
            <FoodSearch onPick={setSelected} />
          ) : tab === 'quick' ? (
            <QuickAdd meal={meal} day={day} onDone={() => onOpenChange(false)} />
          ) : (
            <CreateFood
              onCreated={(food) => {
                setSelected(food);
                setTab('search');
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Dialog>
  );
}

function FoodSearch({ onPick }: { onPick: (food: Food) => void }) {
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q.trim());
  const results = useFoodSearch(deferred);
  const frequent = useFrequentFoods();
  const remove = useHealthMutation((id: string) => api.deleteFood(id), { success: 'Custom food removed' });
  const showFrequent = !deferred && (frequent.data?.length ?? 0) > 0;

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <Input autoFocus placeholder="Search 150+ foods: dosa, chicken, banana…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>
      {showFrequent && (
        <>
          <SectionLabel>Your regulars</SectionLabel>
          <div className="mb-4 flex flex-wrap gap-2">
            {frequent.data!.map((f) => (
              <button key={f.id} className="chip" onClick={() => onPick(f)}>
                <span>{f.emoji}</span>
                {f.name}
              </button>
            ))}
          </div>
          <SectionLabel>Everything</SectionLabel>
        </>
      )}
      <div className="max-h-[46vh] space-y-1 overflow-y-auto pr-1">
        {results.isLoading && Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-14" />)}
        {results.data?.map((f, i) => (
          <FoodRow key={f.id} food={f} index={i} onPick={() => onPick(f)} onDelete={f.custom ? () => remove.mutate(f.id) : undefined} />
        ))}
        {results.data?.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-3">
            No match for “{deferred}”. Try <b>Quick add</b> or create it as a <b>New food</b>.
          </p>
        )}
      </div>
    </div>
  );
}

function FoodRow({ food, index, onPick, onDelete }: { food: FoodHit; index: number; onPick: () => void; onDelete?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.02 }}
      className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors hover:bg-surface-2"
    >
      <button onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xl group-hover:bg-surface-3">{food.emoji ?? '🍴'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {food.name}
            {food.custom && <span className="ml-1.5 rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">mine</span>}
          </span>
          <span className="block truncate text-xs text-ink-3">
            {fmt(food.servingSize, 2)} {food.servingUnit} · P {fmt(food.proteinG, 1)} · C {fmt(food.carbsG, 1)} · F {fmt(food.fatG, 1)}
          </span>
        </span>
        <span className="num text-sm font-semibold text-energy">{fmt(food.calories)}</span>
      </button>
      {onDelete && (
        <button onClick={onDelete} className="rounded-lg p-1.5 text-ink-3 opacity-0 hover:text-bad group-hover:opacity-100" aria-label="Delete custom food">
          <Trash2 className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}

function FoodDetail({ food, meal, day, onBack, onDone }: { food: Food; meal: Meal; day: string; onBack: () => void; onDone: () => void }) {
  const [servings, setServings] = useState((food as FoodHit).lastServings ?? 1);
  const add = useHealthMutation(() => api.addFoodEntry({ loggedOn: day, meal, foodId: food.id, servings }), {
    success: `${food.name} added to ${MEAL_INFO[meal].label.toLowerCase()}`,
    onSuccess: onDone,
  });
  const n = (v: number) => v * servings;

  return (
    <div>
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to search
      </button>
      <div className="flex items-center gap-4">
        <motion.span initial={{ scale: 0.5, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="flex size-16 items-center justify-center rounded-3xl bg-surface-2 text-4xl">
          {food.emoji ?? '🍴'}
        </motion.span>
        <div className="min-w-0">
          <h3 className="display text-xl font-semibold">{food.name}</h3>
          <p className="text-sm text-ink-3">
            1 serving = {fmt(food.servingSize, 2)} {food.servingUnit}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 p-4">
        <div>
          <div className="label mb-2">Servings</div>
          <Stepper value={servings} onChange={setServings} step={0.5} min={0.25} max={20} />
        </div>
        <div className="text-right">
          <AnimatedNumber value={Math.round(n(food.calories))} format={(v) => fmt(v)} duration={0.4} className="display num text-4xl font-semibold text-energy" />
          <div className="text-xs text-ink-3">kcal</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Protein', value: n(food.proteinG), color: 'var(--c-protein)' },
          { label: 'Carbs', value: n(food.carbsG), color: 'var(--c-carbs)' },
          { label: 'Fat', value: n(food.fatG), color: 'var(--c-fat)' },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-line p-3 text-center">
            <div className="num text-lg font-semibold" style={{ color: m.color }}>
              {fmt(m.value, 1)}g
            </div>
            <div className="text-xs text-ink-3">{m.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">
        Fibre {fmt(n(food.fiberG), 1)}g · Sugar {fmt(n(food.sugarG), 1)}g · Sodium {fmt(n(food.sodiumMg))}mg
      </p>

      <Button variant="primary" size="lg" className="mt-5 w-full justify-center" loading={add.isPending} onClick={() => add.mutate()}>
        Add to {MEAL_INFO[meal].label.toLowerCase()}
      </Button>
    </div>
  );
}

function QuickAdd({ meal, day, onDone }: { meal: Meal; day: string; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', calories: '', proteinG: '', carbsG: '', fatG: '' });
  const num = (v: string) => (v ? Number(v) : 0);
  const add = useHealthMutation(
    () =>
      api.addFoodEntry({
        loggedOn: day,
        meal,
        quick: { name: form.name || 'Quick add', calories: num(form.calories), proteinG: num(form.proteinG), carbsG: num(form.carbsG), fatG: num(form.fatG) },
      }),
    { success: 'Added', onSuccess: onDone },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Sparkles className="size-4 text-brand" /> Know the numbers from a label or menu? Log them straight in.
      </p>
      <Field label="What was it?">
        <Input placeholder="e.g. Office canteen lunch" value={form.name} onChange={set('name')} autoFocus />
      </Field>
      <Field label="Calories (kcal)">
        <Input type="number" inputMode="numeric" required min={0} value={form.calories} onChange={set('calories')} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Protein g">
          <Input type="number" inputMode="decimal" min={0} value={form.proteinG} onChange={set('proteinG')} />
        </Field>
        <Field label="Carbs g">
          <Input type="number" inputMode="decimal" min={0} value={form.carbsG} onChange={set('carbsG')} />
        </Field>
        <Field label="Fat g">
          <Input type="number" inputMode="decimal" min={0} value={form.fatG} onChange={set('fatG')} />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={add.isPending}>
        Add {form.calories ? `${form.calories} kcal` : ''}
      </Button>
    </form>
  );
}

const EMOJI_CHOICES = ['🍴', '🥗', '🍛', '🍲', '🥪', '🍳', '🥤', '🍪', '🍎', '🥩', '🍝', '🌯'];

function CreateFood({ onCreated }: { onCreated: (food: Food) => void }) {
  const [emoji, setEmoji] = useState('🍴');
  const [form, setForm] = useState({ name: '', brand: '', servingSize: '1', servingUnit: 'serving', calories: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sugarG: '', sodiumMg: '' });
  const num = (v: string) => (v ? Number(v) : 0);
  const create = useHealthMutation(
    () =>
      api.createFood({
        name: form.name,
        brand: form.brand || null,
        emoji,
        category: 'meals',
        servingSize: num(form.servingSize) || 1,
        servingUnit: form.servingUnit || 'serving',
        calories: num(form.calories),
        proteinG: num(form.proteinG),
        carbsG: num(form.carbsG),
        fatG: num(form.fatG),
        fiberG: num(form.fiberG),
        sugarG: num(form.sugarG),
        sodiumMg: num(form.sodiumMg),
      }),
    { success: (f) => `${f.name} saved to your foods`, onSuccess: onCreated },
  );
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {EMOJI_CHOICES.map((e) => (
          <button type="button" key={e} onClick={() => setEmoji(e)} className={cn('flex size-9 items-center justify-center rounded-xl text-lg transition', emoji === e ? 'scale-110 bg-surface-3 ring-1 ring-line-strong' : 'hover:bg-surface-2')}>
            {e}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" className="col-span-2 sm:col-span-1">
          <Input required value={form.name} onChange={set('name')} placeholder="Mum's rajma chawal" />
        </Field>
        <Field label="Brand (optional)" className="col-span-2 sm:col-span-1">
          <Input value={form.brand} onChange={set('brand')} />
        </Field>
        <Field label="Serving size">
          <Input type="number" inputMode="decimal" min={0.01} step="any" required value={form.servingSize} onChange={set('servingSize')} />
        </Field>
        <Field label="Unit">
          <Input required value={form.servingUnit} onChange={set('servingUnit')} placeholder="g, bowl, piece…" />
        </Field>
      </div>
      <p className="text-xs text-ink-3">Nutrition per serving:</p>
      <div className="grid grid-cols-4 gap-2">
        <Field label="kcal">
          <Input type="number" min={0} required value={form.calories} onChange={set('calories')} />
        </Field>
        <Field label="Protein">
          <Input type="number" min={0} step="any" value={form.proteinG} onChange={set('proteinG')} />
        </Field>
        <Field label="Carbs">
          <Input type="number" min={0} step="any" value={form.carbsG} onChange={set('carbsG')} />
        </Field>
        <Field label="Fat">
          <Input type="number" min={0} step="any" value={form.fatG} onChange={set('fatG')} />
        </Field>
        <Field label="Fibre">
          <Input type="number" min={0} step="any" value={form.fiberG} onChange={set('fiberG')} />
        </Field>
        <Field label="Sugar">
          <Input type="number" min={0} step="any" value={form.sugarG} onChange={set('sugarG')} />
        </Field>
        <Field label="Sodium mg" className="col-span-2">
          <Input type="number" min={0} step="any" value={form.sodiumMg} onChange={set('sodiumMg')} />
        </Field>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={create.isPending}>
        Save food
      </Button>
    </form>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{children}</div>;
}
