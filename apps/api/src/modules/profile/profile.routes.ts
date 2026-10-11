import { eq } from 'drizzle-orm';
import { meUpdate, profileInput, profileUpdate, todayISO } from '@fettle/shared';
import type { App } from '../../app.js';
import { db, schema } from '../../db/client.js';
import { findProfile, requireProfile } from './profile.service.js';

const { users, profiles, weightEntries } = schema;

export async function profileRoutes(app: App) {
  app.get('/me', async (request) => {
    const [user, profile] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, request.userId) }),
      db.query.profiles.findFirst({ where: eq(profiles.userId, request.userId), columns: { userId: true } }),
    ]);
    return {
      id: user!.id,
      name: user!.name,
      email: user!.email,
      createdAt: user!.createdAt.toISOString(),
      onboarded: !!profile,
    };
  });

  app.patch('/me', { schema: { body: meUpdate } }, async (request) => {
    await db.update(users).set({ name: request.body.name, updatedAt: new Date() }).where(eq(users.id, request.userId));
    return { ok: true };
  });

  app.get('/profile', async (request) => findProfile(request.userId));

  /** Onboarding: creates the profile and records the starting weight in one go. */
  app.put('/profile', { schema: { body: profileInput } }, async (request) => {
    const { startWeightKg, startDate, ...fields } = request.body;
    await db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ ...fields, userId: request.userId })
        .onConflictDoUpdate({ target: profiles.userId, set: { ...fields, updatedAt: new Date() } });
      if (startWeightKg) {
        await tx
          .insert(weightEntries)
          .values({ userId: request.userId, measuredOn: startDate ?? todayISO(), weightKg: startWeightKg })
          .onConflictDoUpdate({ target: [weightEntries.userId, weightEntries.measuredOn], set: { weightKg: startWeightKg } });
      }
    });
    return findProfile(request.userId);
  });

  app.patch('/profile', { schema: { body: profileUpdate } }, async (request) => {
    await requireProfile(request.userId);
    const { startWeightKg: _w, startDate: _d, ...fields } = request.body;
    await db.update(profiles).set({ ...fields, updatedAt: new Date() }).where(eq(profiles.userId, request.userId));
    return findProfile(request.userId);
  });
}
