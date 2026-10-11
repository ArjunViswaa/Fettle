import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  copyMealInput,
  dayQuery,
  foodEntryInput,
  foodEntryUpdate,
  foodInput,
  foodSearchQuery,
  waterInput,
  type Food,
  type FoodEntry,
  type Nutrients,
} from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { badRequest, notFound } from '../../lib/http.js';

const { foods, foodEntries, waterEntries } = schema;
const idParams = z.object({ id: z.uuid() });

const NUTRIENT_KEYS = ['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg'] as const satisfies ReadonlyArray<keyof Nutrients>;

function scaled(source: Nutrients, factor: number): Nutrients {
  const out = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) out[key] = Math.round(source[key] * factor * 10) / 10;
  return out;
}

function toFood(row: typeof foods.$inferSelect): Food {
  const { userId, createdAt: _c, deletedAt: _d, ...rest } = row;
  return { ...rest, custom: userId !== null };
}

function toEntry(row: typeof foodEntries.$inferSelect): FoodEntry {
  const { userId: _u, createdAt, ...rest } = row;
  return { ...rest, createdAt: createdAt.toISOString() };
}

/** Foods this user can see: the shared catalogue plus their own, minus deleted ones. */
const visibleTo = (userId: string) => and(isNull(foods.deletedAt), or(isNull(foods.userId), eq(foods.userId, userId)));

export async function nutritionRoutes(app: App) {
  // Foods ---------------------------------------------------------------------

  app.get('/foods/search', { schema: { querystring: foodSearchQuery } }, async (request) => {
    const { q, limit } = request.query;
    const usage = db
      .select({ foodId: foodEntries.foodId, uses: sql<number>`count(*)`.as('uses') })
      .from(foodEntries)
      .where(eq(foodEntries.userId, request.userId))
      .groupBy(foodEntries.foodId)
      .as('usage');

    const term = q.toLowerCase();
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db
      .select({ food: foods, uses: sql<number>`coalesce(${usage.uses}, 0)` })
      .from(foods)
      .leftJoin(usage, eq(usage.foodId, foods.id))
      .where(
        and(
          visibleTo(request.userId),
          // ILIKE and the % similarity operator both use the trigram index.
          term ? or(sql`${foods.name} ilike ${like}`, sql`${foods.name} % ${term}`) : undefined,
        ),
      )
      .orderBy(
        ...(term
          ? [desc(sql`lower(${foods.name}) like ${term.replace(/[\\%_]/g, (c) => `\\${c}`) + '%'}`), desc(sql`similarity(${foods.name}, ${term})`)]
          : []),
        desc(sql`coalesce(${usage.uses}, 0)`),
        asc(foods.name),
      )
      .limit(limit);
    return rows.map((r) => ({ ...toFood(r.food), uses: r.uses }));
  });

  /** The foods you log most, for one-tap re-adding. */
  app.get('/foods/frequent', async (request) => {
    const rows = await db
      .select({ food: foods, uses: sql<number>`count(*)`, lastServings: sql<number>`(array_agg(${foodEntries.servings} order by ${foodEntries.createdAt} desc))[1]` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.userId, request.userId), isNull(foods.deletedAt), sql`${foodEntries.loggedOn} > current_date - 90`))
      .groupBy(foods.id)
      .orderBy(desc(sql`count(*)`))
      .limit(12);
    return rows.map((r) => ({ ...toFood(r.food), uses: r.uses, lastServings: r.lastServings }));
  });

  app.post('/foods', { schema: { body: foodInput } }, async (request, reply) => {
    const [row] = await db
      .insert(foods)
      .values({ ...request.body, userId: request.userId })
      .returning();
    return reply.code(201).send(toFood(row!));
  });

  app.delete('/foods/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .update(foods)
      .set({ deletedAt: new Date() })
      .where(and(eq(foods.id, request.params.id), eq(foods.userId, request.userId)))
      .returning({ id: foods.id });
    if (!row) throw notFound('Custom food');
    return { ok: true };
  });

  // Diary ---------------------------------------------------------------------

  app.get('/food-entries', { schema: { querystring: dayQuery } }, async (request) => {
    const rows = await db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, request.userId), eq(foodEntries.loggedOn, request.query.date)))
      .orderBy(asc(foodEntries.createdAt));
    return rows.map(toEntry);
  });

  app.post('/food-entries', { schema: { body: foodEntryInput } }, async (request, reply) => {
    const { loggedOn, meal, foodId, servings, quick } = request.body;
    let values: typeof foodEntries.$inferInsert;
    if (foodId) {
      const food = await db.query.foods.findFirst({ where: and(eq(foods.id, foodId), visibleTo(request.userId)) });
      if (!food) throw notFound('Food');
      values = {
        userId: request.userId,
        loggedOn,
        meal,
        foodId,
        name: food.name,
        emoji: food.emoji,
        servings,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        ...scaled(food, servings),
      };
    } else if (quick) {
      const { name, ...nutrients } = quick;
      values = { userId: request.userId, loggedOn, meal, name, emoji: '⚡', servings: 1, ...scaled(nutrients, 1) };
    } else {
      throw badRequest('Choose a food or enter calories');
    }
    const [row] = await db.insert(foodEntries).values(values).returning();
    return reply.code(201).send(toEntry(row!));
  });

  app.patch('/food-entries/:id', { schema: { params: idParams, body: foodEntryUpdate } }, async (request) => {
    const existing = await db.query.foodEntries.findFirst({
      where: and(eq(foodEntries.id, request.params.id), eq(foodEntries.userId, request.userId)),
    });
    if (!existing) throw notFound('Entry');
    const { servings, ...fields } = request.body;
    // Nutrients were stored for the old serving count; rescale them rather than re-reading the food.
    const rescale = servings && servings !== existing.servings ? { servings, ...scaled(existing, servings / existing.servings) } : {};
    const [row] = await db
      .update(foodEntries)
      .set({ ...fields, ...rescale })
      .where(eq(foodEntries.id, existing.id))
      .returning();
    return toEntry(row!);
  });

  app.delete('/food-entries/:id', { schema: { params: idParams } }, async (request) => {
    const [row] = await db
      .delete(foodEntries)
      .where(and(eq(foodEntries.id, request.params.id), eq(foodEntries.userId, request.userId)))
      .returning();
    if (!row) throw notFound('Entry');
    return toEntry(row);
  });

  /** Copy a day's meals (or one meal) to another day: "same breakfast as yesterday". */
  app.post('/food-entries/copy', { schema: { body: copyMealInput } }, async (request) => {
    const { fromDate, toDate, meal } = request.body;
    const source = await db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.userId, request.userId), eq(foodEntries.loggedOn, fromDate), meal ? eq(foodEntries.meal, meal) : undefined))
      .orderBy(asc(foodEntries.createdAt));
    if (!source.length) throw badRequest('Nothing was logged there to copy');
    const rows = await db
      .insert(foodEntries)
      .values(source.map(({ id: _id, createdAt: _c, ...rest }) => ({ ...rest, loggedOn: toDate })))
      .returning();
    return rows.map(toEntry);
  });

  // Water ---------------------------------------------------------------------

  app.get('/water', { schema: { querystring: dayQuery } }, async (request) => {
    const rows = await db
      .select({ id: waterEntries.id, amountMl: waterEntries.amountMl, createdAt: waterEntries.createdAt })
      .from(waterEntries)
      .where(and(eq(waterEntries.userId, request.userId), eq(waterEntries.loggedOn, request.query.date)))
      .orderBy(asc(waterEntries.createdAt));
    return {
      totalMl: rows.reduce((a, r) => a + r.amountMl, 0),
      entries: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  });

  app.post('/water', { schema: { body: waterInput } }, async (request, reply) => {
    const { loggedOn, amountMl } = request.body;
    if (amountMl === 0) throw badRequest('Amount must not be zero');
    if (amountMl < 0) {
      // Removing water: never let the day's total go below zero.
      const [{ total } = { total: 0 }] = await db
        .select({ total: sql<number>`coalesce(sum(${waterEntries.amountMl}), 0)` })
        .from(waterEntries)
        .where(and(eq(waterEntries.userId, request.userId), eq(waterEntries.loggedOn, loggedOn)));
      if (total + amountMl < 0) throw badRequest('There is not that much water logged today');
    }
    await db.insert(waterEntries).values({ userId: request.userId, loggedOn, amountMl });
    return reply.code(201).send({ ok: true });
  });
}
