// Weekly realism math: free time, the protected buffer, and what to cut when overloaded.
// Days that have already passed this week are excluded from the headline totals and
// can't be altered, so the rating reflects only the days still to come.
import { DAYS, blockHours, todayISO, addDaysISO, weekKey } from './time.js';
import { weekTasks, weekCommitments } from './week.js';

// Per-day and whole-week breakdown of committed / free / buffer / available / planned
// hours for the week starting `wk` (Monday ISO; defaults to the current week).
export function plannerStats(state, wk = weekKey(new Date())) {
  const { commitments, tasks, settings } = state;
  const bufferPct = settings.bufferPct;
  const repeat = settings.repeatCommitments;
  const today = todayISO();

  const days = DAYS.map((name, di) => {
    const committed = weekCommitments(commitments, di, wk, repeat)
      .reduce((s, c) => s + blockHours(c.start, c.end), 0);
    const free = Math.max(0, 24 - committed);
    const buffer = free * bufferPct; // protected safety net
    const available = Math.max(0, free - buffer); // schedulable time
    const planned = weekTasks(tasks, di, wk, repeat)
      .reduce((s, t) => s + (Number(t.hours) || 0), 0);
    const leftover = available - planned; // negative = overflow
    const past = addDaysISO(wk, di) < today; // locked once that calendar day has passed
    return { di, name, past, committed, free, buffer, available, planned, leftover };
  });

  const total = (list) =>
    list.reduce(
      (a, d) => ({
        committed: a.committed + d.committed,
        free: a.free + d.free,
        buffer: a.buffer + d.buffer,
        available: a.available + d.available,
        planned: a.planned + d.planned,
        leftover: a.leftover + d.leftover,
      }),
      { committed: 0, free: 0, buffer: 0, available: 0, planned: 0, leftover: 0 }
    );

  const tot = total(days);
  const remaining = total(days.filter((d) => !d.past)); // today onward

  // Rate the days still to come against their schedulable (post-buffer) time.
  let rating = 'Comfortable';
  if (remaining.planned > remaining.available) rating = 'Overloaded';
  else if (remaining.planned > remaining.available * 0.85) rating = 'Tight';

  return { days, tot, remaining, rating, bufferPct, wk };
}

// When the rest of the week is Overloaded, suggest what to drop — strictly from the
// bottom of the priorities list upward, ceiling/bonus tasks only, and only on days
// that haven't passed. Floor tasks and the golden list are never cut.
export function cutSuggestions(state, wk = weekKey(new Date())) {
  const stats = plannerStats(state, wk);
  if (stats.rating !== 'Overloaded') {
    return { cuts: [], freed: 0, remainingOverflow: 0, enough: true };
  }

  const rankOf = {};
  state.priorities.forEach((p, i) => {
    rankOf[p.id] = i; // higher index = lower priority = bottom of the list
  });

  // Days of this week that haven't passed yet.
  const repeat = state.settings.repeatCommitments;
  const futureDays = new Set(stats.days.filter((d) => !d.past).map((d) => d.di));
  const candidates = state.tasks
    .filter((t) => t.kind === 'ceiling' && (repeat || t.weekStart === wk) && futureDays.has(t.day))
    .sort(
      (a, b) =>
        (rankOf[b.categoryId] ?? -1) - (rankOf[a.categoryId] ?? -1) ||
        (Number(b.hours) || 0) - (Number(a.hours) || 0)
    );

  let overflow = stats.remaining.planned - stats.remaining.available;
  const cuts = [];
  let freed = 0;
  for (const t of candidates) {
    if (overflow <= 0) break;
    cuts.push(t);
    freed += Number(t.hours) || 0;
    overflow -= Number(t.hours) || 0;
  }

  return {
    cuts,
    freed,
    remainingOverflow: Math.max(0, overflow),
    enough: overflow <= 0,
  };
}
