import { DateTime } from 'luxon';

const PARIS = 'Europe/Paris';

export function nowParis() {
  return DateTime.now().setZone(PARIS);
}

export function formatParisIso(dt) {
  return dt.setZone(PARIS).toISO({ suppressMilliseconds: true });
}

/** Horodatage du relevé = instant du run (Paris, sans millisecondes). */
export function getSnapshotTimestamp() {
  return nowParis().set({ millisecond: 0 });
}

export function hoursBetween(ts1, ts2) {
  const a = DateTime.fromISO(ts1, { zone: PARIS });
  const b = DateTime.fromISO(ts2, { zone: PARIS });
  return Math.max(0.01, b.diff(a, 'hours').hours);
}

export function formatDisplayFr(dtIso) {
  const dt = DateTime.fromISO(dtIso, { zone: PARIS });
  if (!dt.isValid) return dtIso;
  return dt.setLocale('fr').format("d MMMM à HH'h'");
}
