// Dashboard time window (docs/lab-04/specification.md BR-23). The time zone is Asia/Bangkok, a fixed UTC+7
// with no daylight saving, so no time-zone database is needed: shift the instant by the offset, take the
// calendar day, and shift back.
export const DASHBOARD_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "Recent" runs from 00:00 Bangkok time six days before today through now: 7 calendar days, today included.
export function bangkokWindowStart(now: Date): Date {
  // After the shift, the UTC fields of `shifted` read as the Bangkok wall clock.
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  const bangkokMidnightAsUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(bangkokMidnightAsUtc - 6 * DAY_MS - BANGKOK_OFFSET_MS);
}
