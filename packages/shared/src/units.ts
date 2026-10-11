import type { UnitSystem } from './constants.js';

/** Everything is stored metric; these convert only at the edges (display and input). */
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const KM_PER_MI = 1.609344;
export const ML_PER_FLOZ = 29.5735;

const fixed = (n: number, digits: number) => Number(n.toFixed(digits));

export const kgToDisplay = (kg: number, units: UnitSystem) => (units === 'imperial' ? fixed(kg / KG_PER_LB, 1) : fixed(kg, 1));
export const displayToKg = (value: number, units: UnitSystem) => (units === 'imperial' ? value * KG_PER_LB : value);
export const weightUnit = (units: UnitSystem) => (units === 'imperial' ? 'lb' : 'kg');

export const cmToDisplay = (cm: number, units: UnitSystem) => (units === 'imperial' ? fixed(cm / CM_PER_IN, 1) : fixed(cm, 1));
export const displayToCm = (value: number, units: UnitSystem) => (units === 'imperial' ? value * CM_PER_IN : value);
export const lengthUnit = (units: UnitSystem) => (units === 'imperial' ? 'in' : 'cm');

export const kmToDisplay = (km: number, units: UnitSystem) => (units === 'imperial' ? fixed(km / KM_PER_MI, 2) : fixed(km, 2));
export const displayToKm = (value: number, units: UnitSystem) => (units === 'imperial' ? value * KM_PER_MI : value);
export const distanceUnit = (units: UnitSystem) => (units === 'imperial' ? 'mi' : 'km');

export const mlToDisplay = (ml: number, units: UnitSystem) => (units === 'imperial' ? fixed(ml / ML_PER_FLOZ, 0) : Math.round(ml));
export const displayToMl = (value: number, units: UnitSystem) => (units === 'imperial' ? value * ML_PER_FLOZ : value);
export const volumeUnit = (units: UnitSystem) => (units === 'imperial' ? 'fl oz' : 'ml');

export function formatHeight(cm: number, units: UnitSystem): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / CM_PER_IN);
  return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
}

export function formatWater(ml: number, units: UnitSystem): string {
  if (units === 'imperial') return `${Math.round(ml / ML_PER_FLOZ)} fl oz`;
  return ml >= 1000 ? `${fixed(ml / 1000, 2)} L` : `${Math.round(ml)} ml`;
}

/** Celsius is stored; Fahrenheit shown for imperial users. */
export const celsiusToDisplay = (c: number, units: UnitSystem) => (units === 'imperial' ? fixed((c * 9) / 5 + 32, 1) : fixed(c, 1));
export const displayToCelsius = (value: number, units: UnitSystem) => (units === 'imperial' ? ((value - 32) * 5) / 9 : value);
