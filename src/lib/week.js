// Per-week filtering rules shared across planner/timeline/scoring.
//
// Tasks are always week-specific (tagged with `weekStart` = the week's Monday ISO).
// Commitments are week-specific too, EXCEPT: sleep always repeats (it defines the
// waking window every week), and when settings.repeatCommitments is on, every
// commitment shows on every week (the original recurring behaviour).
const SLEEP_RE = /sleep/i;

export const isSleep = (c) => SLEEP_RE.test(c?.label || '');

// Tasks on day `di` of week `wk`.
export function weekTasks(tasks, di, wk) {
  return tasks.filter((t) => t.day === di && t.weekStart === wk);
}

// Commitments on day `di` of week `wk`, honouring the repeat setting.
export function weekCommitments(commitments, di, wk, repeat) {
  return commitments.filter(
    (c) => c.day === di && (isSleep(c) || repeat || c.weekStart === wk)
  );
}
