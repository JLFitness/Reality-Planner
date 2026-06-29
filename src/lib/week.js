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

// Tasks on day `di` of week `wk`, honouring the repeat setting.
export function weekTasks(tasks, di, wk, repeat) {
  return tasks.filter((t) => t.day === di && (repeat || t.weekStart === wk));
}

// Commitments on day `di` of week `wk`, honouring the repeat setting.
export function weekCommitments(commitments, di, wk, repeat) {
  return commitments.filter(
    (c) => c.day === di && (isSleep(c) || repeat || c.weekStart === wk)
  );
}
