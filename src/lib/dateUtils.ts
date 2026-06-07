export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `datetime-local` value in the user's local timezone (minute precision). */
export function formatDatetimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Parse stored contest ISO / timestamptz into a `datetime-local` string. */
export function parseContestDateToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDatetimeLocal(d);
}

export function dateAtStartOfDayLocal(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return formatDatetimeLocal(x);
}

export function dateAtEndOfDayLocal(d: Date): string {
  const x = new Date(d);
  x.setHours(23, 59, 0, 0);
  return formatDatetimeLocal(x);
}

/**
 * When the user changes the calendar date, default start to 00:00 and end to 23:59.
 * If only the time changes, keep the full value.
 */
export function smartDatetimeLocalUpdate(
  previousValue: string,
  nextValue: string,
  role: 'start' | 'end'
): string {
  if (!nextValue) return nextValue;
  const prevD = previousValue.slice(0, 10);
  const nextD = nextValue.slice(0, 10);
  if (nextD && nextD !== prevD) {
    return role === 'start' ? `${nextD}T00:00` : `${nextD}T23:59`;
  }
  return nextValue;
}

export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateString(yesterday);
}

export function getTodayString(): string {
  return getLocalDateString(new Date());
}

export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}
