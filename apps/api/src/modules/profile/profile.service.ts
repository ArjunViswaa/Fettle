import { asc, desc, eq } from 'drizzle-orm';
import { ageOn, todayISO, type Profile } from '@fettle/shared';
import { db, schema } from '../../db/client.js';
import { HttpError } from '../../lib/http.js';

const { profiles, weightEntries } = schema;

/** Used when someone hasn't weighed in yet; only feeds calorie-burn estimates. */
const FALLBACK_WEIGHT_KG = 70;

export async function findProfile(userId: string): Promise<Profile | null> {
  const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!row) return null;

  const [first, latest] = await Promise.all([
    db.query.weightEntries.findFirst({ where: eq(weightEntries.userId, userId), orderBy: asc(weightEntries.measuredOn) }),
    db.query.weightEntries.findFirst({ where: eq(weightEntries.userId, userId), orderBy: desc(weightEntries.measuredOn) }),
  ]);

  const { userId: _owner, createdAt: _c, updatedAt: _u, ...fields } = row;
  return {
    ...fields,
    age: ageOn(row.birthDate, todayISO()),
    startWeightKg: first?.weightKg ?? null,
    latestWeightKg: latest?.weightKg ?? null,
  };
}

export async function requireProfile(userId: string): Promise<Profile> {
  const profile = await findProfile(userId);
  if (!profile) throw new HttpError(409, 'Finish setting up your profile first', 'needs_onboarding');
  return profile;
}

export async function currentWeightKg(userId: string): Promise<number> {
  const latest = await db.query.weightEntries.findFirst({
    where: eq(weightEntries.userId, userId),
    orderBy: desc(weightEntries.measuredOn),
    columns: { weightKg: true },
  });
  return latest?.weightKg ?? FALLBACK_WEIGHT_KG;
}
