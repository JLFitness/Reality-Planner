// Small date/time helpers. Week runs Monday (0) .. Sunday (6).

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const pad = (n) => String(n).padStart(2, '0');

export function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

// Hours between two 'HH:MM' times. Handles overnight windows (e.g. 23:00 -> 07:00).
export function blockHours(start, end) {
  let s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

// Add a number of hours to a 'HH:MM' clock time, wrapping past midnight.
export function addClock(hhmm, hours) {
  const m = ((toMinutes(hhmm) + Math.round(hours * 60)) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// Minute-of-day -> short label, e.g. 420 -> "7am", 780 -> "1pm".
export function clockLabel(min) {
  const h = Math.floor((min / 60) % 24);
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}${h < 12 ? 'am' : 'pm'}`;
}

// Minute-of-day -> 'HH:MM'.
export function minToHHMM(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// Minute-of-day -> friendly 12h clock, e.g. 630 -> "10:30 AM".
export function prettyClock(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(new Date());
}

// Monday = 0 .. Sunday = 6
export function dayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function mondayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - dayIndex(d));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekKey(date) {
  return toISO(mondayOf(date));
}

export function weekDates(anyDateInWeek) {
  const mon = mondayOf(anyDateInWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toISO(d);
  });
}

export function addDaysISO(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function prettyDate(iso) {
  const d = fromISO(iso);
  return `${DAY_LONG[dayIndex(d)]} ${d.getDate()}/${d.getMonth() + 1}`;
}

// Round to 1 decimal and drop trailing ".0" for clean display.
export function hrs(n) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
