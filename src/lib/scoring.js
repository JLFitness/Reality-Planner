// Day scoring, floor-hit streak, and weekly aggregation.
import { fromISO, dayIndex, todayISO, addDaysISO, weekDates, weekKey } from './time.js';
import { weekTasks } from './week.js';

// A task counts as done if its tick is set, or (for countable tasks) the logged
// quantity reaches its target.
export function isTaskDone(task, entry) {
  if (!entry) return false;
  if (task.countable) return (Number(entry.qty) || 0) >= (Number(task.target) || 1);
  return !!entry.done;
}

// Score a single date.
//   floor met (golden list + all floor tasks done) => 100% + bonus from ceiling items
//   floor not met                                   => proportional, always below 100%
// Bonus is split evenly across the day's ceiling tasks and capped so the total never
// exceeds 150%.
export function dayScore(state, iso) {
  const di = dayIndex(fromISO(iso));
  const wk = weekKey(fromISO(iso));
  const dlog = state.log[iso] || { golden: {}, tasks: {} };
  const golden = state.golden;
  const dayTasks = weekTasks(state.tasks, di, wk, state.settings.repeatCommitments);
  const floorTasks = dayTasks.filter((t) => t.kind === 'floor');
  const ceilTasks = dayTasks.filter((t) => t.kind === 'ceiling');

  const goldenDone = golden.filter((g) => dlog.golden?.[g.id]).length;
  const floorTasksDone = floorTasks.filter((t) => isTaskDone(t, dlog.tasks?.[t.id])).length;

  const floorTotal = golden.length + floorTasks.length;
  const floorDone = goldenDone + floorTasksDone;
  const floorMet = floorTotal > 0 && floorDone === floorTotal;

  const ceilTotal = ceilTasks.length;
  const ceilDone = ceilTasks.filter((t) => isTaskDone(t, dlog.tasks?.[t.id])).length;

  let score;
  if (floorMet) {
    score = 100 + (ceilTotal > 0 ? (ceilDone / ceilTotal) * 50 : 0);
  } else {
    score = floorTotal > 0 ? (floorDone / floorTotal) * 100 : 0;
  }

  return {
    score: Math.min(150, Math.round(score)),
    floorMet,
    floorDone,
    floorTotal,
    ceilDone,
    ceilTotal,
    hasItems: floorTotal > 0 || ceilTotal > 0,
  };
}

// Consecutive days the floor was met, counting back from `endISO`. The current day is
// treated leniently (if not yet met it's skipped, not counted as a break) so an
// in-progress today doesn't zero out the streak.
export function floorStreak(state, endISO = todayISO()) {
  let streak = 0;
  let iso = endISO;

  const today = dayScore(state, iso);
  if (today.floorMet) streak += 1;
  iso = addDaysISO(iso, -1);

  for (let i = 0; i < 366; i += 1) {
    const s = dayScore(state, iso);
    if (s.floorMet) {
      streak += 1;
      iso = addDaysISO(iso, -1);
    } else {
      break;
    }
  }
  return streak;
}

// Aggregate one week (Mon..Sun). Averages only over days that actually had planned items.
export function weekSummary(state, anyISO) {
  const dates = weekDates(fromISO(anyISO));
  const scored = dates.map((iso) => ({ iso, ...dayScore(state, iso) }));
  const active = scored.filter((s) => s.hasItems);
  const avg = active.length
    ? Math.round(active.reduce((a, s) => a + s.score, 0) / active.length)
    : 0;
  const floorHits = active.filter((s) => s.floorMet).length;
  const floorRate = active.length ? Math.round((floorHits / active.length) * 100) : 0;
  return { dates, scored, avg, floorHits, activeDays: active.length, floorRate };
}

// Aggregate any date range [from, to] (inclusive ISO strings). Averages only over
// days that had planned items. Drives the Week/Month/Year views in the Review.
export function rangeStats(state, from, to) {
  const today = todayISO();
  let iso = from;
  let sum = 0;
  let active = 0;
  let hits = 0;
  for (let i = 0; i < 400 && iso <= to; i += 1) {
    const s = dayScore(state, iso);
    // Count days that have something to score, but never future days (they can't
    // have happened yet, so they shouldn't drag the average to 0).
    if (s.hasItems && iso <= today) {
      active += 1;
      sum += s.score;
      if (s.floorMet) hits += 1;
    }
    iso = addDaysISO(iso, 1);
  }
  return {
    avg: active ? Math.round(sum / active) : 0,
    mandatoryRate: active ? Math.round((hits / active) * 100) : 0,
    activeDays: active,
  };
}

// The most recent weigh-ins (oldest→newest), each as { iso, value }. Used for the
// Review weight trend so logged weights always show, independent of the score range.
export function recentWeights(state, limit = 30) {
  return Object.keys(state.log || {})
    .filter((iso) => typeof state.log[iso]?.weight === 'number')
    .sort()
    .slice(-limit)
    .map((iso) => ({ iso, value: state.log[iso].weight }));
}

// Average logged weight over a date range, or null if nothing logged.
export function weightAvgRange(state, from, to) {
  let iso = from;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 400 && iso <= to; i += 1) {
    const w = state.log[iso]?.weight;
    if (typeof w === 'number') {
      sum += w;
      n += 1;
    }
    iso = addDaysISO(iso, 1);
  }
  return n ? Math.round((sum / n) * 10) / 10 : null;
}

// Like targetActuals but over an arbitrary range (used for Month/Year views). The
// per-week target is scaled by the number of weeks elsewhere.
export function targetActualsRange(state, from, to) {
  const nameOf = (id) => (state.priorities.find((p) => p.id === id) || {}).name || '—';
  const repeat = state.settings.repeatCommitments;
  return state.targets.map((tgt) => {
    let done = 0;
    let iso = from;
    for (let i = 0; i < 400 && iso <= to; i += 1) {
      const di = dayIndex(fromISO(iso));
      const wk = weekKey(fromISO(iso));
      const dlog = state.log[iso] || { tasks: {} };
      for (const t of weekTasks(state.tasks, di, wk, repeat).filter((tk) => tk.categoryId === tgt.categoryId)) {
        const entry = dlog.tasks?.[t.id];
        const isDone = isTaskDone(t, entry);
        if (tgt.metric === 'hours' && isDone) done += Number(t.hours) || 0;
        else if (tgt.metric === 'sessions' && isDone) done += 1;
        else if (tgt.metric === 'count' && t.countable && entry) done += Number(entry.qty) || 0;
      }
      iso = addDaysISO(iso, 1);
    }
    return { ...tgt, done, categoryName: nameOf(tgt.categoryId) };
  });
}

// "Done" for each user-defined target this week, computed from tasks via the
// target's category + metric.
//   hours    -> sum of completed task hours in the category
//   sessions -> count of completed tasks in the category
//   count    -> sum of logged quantities for countable tasks in the category
export function targetActuals(state, anyISO) {
  const dates = weekDates(fromISO(anyISO));
  const nameOf = (id) => (state.priorities.find((p) => p.id === id) || {}).name || '—';
  const repeat = state.settings.repeatCommitments;

  return state.targets.map((tgt) => {
    let done = 0;
    for (const iso of dates) {
      const di = dayIndex(fromISO(iso));
      const wk = weekKey(fromISO(iso));
      const dlog = state.log[iso] || { tasks: {} };
      for (const t of weekTasks(state.tasks, di, wk, repeat).filter((tk) => tk.categoryId === tgt.categoryId)) {
        const entry = dlog.tasks?.[t.id];
        const isDone = isTaskDone(t, entry);
        if (tgt.metric === 'hours' && isDone) done += Number(t.hours) || 0;
        else if (tgt.metric === 'sessions' && isDone) done += 1;
        else if (tgt.metric === 'count' && t.countable && entry) done += Number(entry.qty) || 0;
      }
    }
    return { ...tgt, done, categoryName: nameOf(tgt.categoryId) };
  });
}
