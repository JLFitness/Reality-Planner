// Per-week filtering rules shared across planner/timeline/scoring.
//
// Both tasks and commitments are tagged with `weekStart` (the week's Monday ISO),
// but the `repeat` flag (settings.repeatCommitments) governs whether they behave as
// a recurring routine or a per-week plan:
//   repeat on  -> the item shows on EVERY week (weekStart ignored). This is the
//                 default, preserves history, and matches the original behaviour.
//   repeat off -> the item only shows on the week it's tagged to.
// Sleep always repeats regardless (it defines the waking window every week).
const SLEEP_RE = /sleep/i;

export const isSleep = (c) => SLEEP_RE.test(c?.label || '');

// Identity of a task as a routine item: two records with the same key are "the same
// task" repeated across weeks. Used to collapse / bulk-remove duplicates in repeat mode.
export const taskKey = (t) =>
  `${t.day}|${t.title}|${t.kind}|${t.hours}|${t.categoryId}|${t.start || ''}`;

// Drop records that share a routine identity, keeping the first of each.
export function dedupeTasks(list) {
  const seen = new Set();
  return list.filter((t) => {
    const k = taskKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Tasks on day `di` of week `wk`, honouring the repeat setting.
export function weekTasks(tasks, di, wk, repeat) {
  const onDay = tasks.filter((t) => t.day === di && (repeat || t.weekStart === wk));
  // In repeat mode every week shows the same routine, so a task that exists as
  // several per-week records (e.g. copied into multiple weeks) would otherwise
  // appear — and score — multiple times. Collapse identical ones to a single item.
  return repeat ? dedupeTasks(onDay) : onDay;
}

// Commitments on day `di` of week `wk`, honouring the repeat setting.
export function weekCommitments(commitments, di, wk, repeat) {
  return commitments.filter(
    (c) => c.day === di && (isSleep(c) || repeat || c.weekStart === wk)
  );
}
