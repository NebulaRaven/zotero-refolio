export interface ZonedDate<T> { local(): T; utcOffset(minutes: number): T; }
// SPDX-License-Identifier: AGPL-3.0-or-later
export function spDisplayDate<T>(dayjs: { utc(value: unknown): ZonedDate<T> }, utcValue: unknown, zone: string | number | null | undefined = "system"): T {
  const date = dayjs.utc(utcValue);
  if (zone === "system" || zone === undefined || zone === null || zone === "") return date.local();
  const offset = Number(zone);
  if (!Number.isFinite(offset) || offset < -12 || offset > 14) throw new Error("ui-error-invalid-utc-offset");
  return date.utcOffset(offset * 60);
}
