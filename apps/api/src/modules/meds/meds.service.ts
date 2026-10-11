import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import type { DoseSlot } from '@fettle/shared';
import { db, schema } from '../../db/client.js';

const { medications, medicationDoses } = schema;

/** Every scheduled dose for a day, with whether it was taken or skipped. */
export async function dosesForDay(userId: string, day: string): Promise<DoseSlot[]> {
  const [meds, doses] = await Promise.all([
    db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.userId, userId),
          isNull(medications.archivedAt),
          lte(medications.startedOn, day),
          or(isNull(medications.endsOn), gte(medications.endsOn, day)),
        ),
      ),
    db
      .select()
      .from(medicationDoses)
      .where(and(eq(medicationDoses.userId, userId), eq(medicationDoses.day, day))),
  ]);

  const slots: DoseSlot[] = [];
  for (const med of meds) {
    for (const time of med.times) {
      const dose = doses.find((d) => d.medicationId === med.id && d.time === time);
      slots.push({
        medicationId: med.id,
        name: med.name,
        dosage: med.dosage,
        color: med.color,
        time,
        status: dose?.status ?? 'pending',
        takenAt: dose?.takenAt?.toISOString() ?? null,
      });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}
