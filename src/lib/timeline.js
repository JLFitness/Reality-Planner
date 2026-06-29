// Geometry for the visual day board.
//
// A day is drawn as a vertical column spanning the WAKING window (the gap between
// sleep blocks). Fixed commitments are anchored at their real times. Tasks may be
// scheduled (a `start` time, anchored) or floating (flowed into free space). The
// free time (after commitments) is split into a schedulable part and a protected
// buffer band; floating tasks flow into the schedulable part and spill into the
// buffer (flagged overloaded) only when there's too much.
import { toMinutes, weekKey } from './time.js';
import { categoryColor, FIXED_COLOR } from './colors.js';
import { weekTasks, weekCommitments, isSleep } from './week.js';

export const SNAP_MIN = 30; // drag granularity
const SLEEP_RE = /sleep/i;
const DEFAULT_WK = () => weekKey(new Date());
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function commitmentSpan(c) {
  let start = toMinutes(c.start);
  let end = toMinutes(c.end);
  if (end <= start) end += 1440;
  return { start, end };
}

// Waking window [W0, W1] in minutes, derived from the day's sleep block.
export function wakingWindow(state, di) {
  const sleeps = state.commitments.filter((c) => c.day === di && SLEEP_RE.test(c.label || ''));
  if (sleeps.length) {
    const s = sleeps[0];
    const wake = toMinutes(s.end); // morning
    let bed = toMinutes(s.start); // night
    if (bed <= wake) bed += 1440;
    return { W0: wake, W1: bed };
  }
  return { W0: 7 * 60, W1: 23 * 60 }; // sensible default if sleep was removed
}

// Commitments + anchored tasks that occupy fixed time on a day. `excludeId` skips
// the item being moved (a task id or a commitment id).
export function occupiedRanges(state, di, excludeId, wk = DEFAULT_WK()) {
  const { W0, W1 } = wakingWindow(state, di);
  const repeat = state.settings.repeatCommitments;
  const out = [];
  for (const c of weekCommitments(state.commitments, di, wk, repeat)) {
    if (c.id === excludeId || isSleep(c)) continue;
    const { start, end } = commitmentSpan(c);
    out.push({ start: clamp(start, W0, W1), end: clamp(end, W0, W1) });
  }
  for (const t of weekTasks(state.tasks, di, wk, repeat).filter((t) => t.start && t.id !== excludeId)) {
    const s = toMinutes(t.start);
    out.push({ start: clamp(s, W0, W1), end: clamp(s + (Number(t.hours) || 0) * 60, W0, W1) });
  }
  return out.filter((r) => r.end - r.start > 0.01).sort((a, b) => a.start - b.start);
}

// Snap to a free slot of `durMin` near `desiredStartMin`. Returns minutes or null.
export function findDropStart(state, di, taskId, desiredStartMin, durMin, wk = DEFAULT_WK()) {
  const { W0, W1 } = wakingWindow(state, di);
  const occ = occupiedRanges(state, di, taskId, wk);
  const maxStart = W1 - durMin;
  if (maxStart < W0) return null;
  const fits = (s) => s >= W0 && s + durMin <= W1 && !occ.some((r) => s < r.end - 0.01 && s + durMin > r.start + 0.01);
  const base = clamp(Math.round(desiredStartMin / SNAP_MIN) * SNAP_MIN, W0, maxStart);
  for (let delta = 0; delta <= W1 - W0; delta += SNAP_MIN) {
    const down = base + delta;
    const up = base - delta;
    if (down <= maxStart && fits(down)) return down;
    if (up >= W0 && fits(up)) return up;
  }
  return null;
}

// Subtract `mins` worth from the bottom of a list of intervals, tagging each part.
function carveBuffer(intervals, mins) {
  let remaining = mins;
  const out = [];
  for (let i = intervals.length - 1; i >= 0; i -= 1) {
    const iv = intervals[i];
    const len = iv.end - iv.start;
    if (remaining <= 0) {
      out.unshift({ ...iv, kind: 'sched' });
    } else if (len <= remaining) {
      out.unshift({ ...iv, kind: 'buffer' });
      remaining -= len;
    } else {
      const splitAt = iv.end - remaining;
      out.unshift({ start: splitAt, end: iv.end, kind: 'buffer' });
      out.unshift({ start: iv.start, end: splitAt, kind: 'sched' });
      remaining = 0;
    }
  }
  return out;
}

// Remove `ranges` from `intervals`, keeping each piece's kind tag.
function subtractRanges(intervals, ranges) {
  const cuts = ranges.slice().sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of intervals) {
    let segs = [{ start: iv.start, end: iv.end, kind: iv.kind }];
    for (const c of cuts) {
      const next = [];
      for (const sg of segs) {
        if (c.end <= sg.start || c.start >= sg.end) {
          next.push(sg);
          continue;
        }
        if (c.start > sg.start) next.push({ start: sg.start, end: c.start, kind: sg.kind });
        if (c.end < sg.end) next.push({ start: c.end, end: sg.end, kind: sg.kind });
      }
      segs = next;
    }
    out.push(...segs);
  }
  return out.filter((s) => s.end - s.start > 0.01);
}

// Flow ordered segments into ordered intervals, splitting across boundaries.
function flow(intervals, segs) {
  const pieces = [];
  let ii = 0;
  let cursor = intervals.length ? intervals[0].start : 0;
  for (const seg of segs) {
    let rem = seg.minutes;
    let first = true;
    while (rem > 0.01 && ii < intervals.length) {
      const iv = intervals[ii];
      if (cursor < iv.start) cursor = iv.start;
      const space = iv.end - cursor;
      if (space <= 0.01) {
        ii += 1;
        if (ii < intervals.length) cursor = intervals[ii].start;
        continue;
      }
      const take = Math.min(space, rem);
      pieces.push({ start: cursor, end: cursor + take, seg, first, kind: iv.kind });
      cursor += take;
      rem -= take;
      first = false;
      if (cursor >= iv.end - 0.01) {
        ii += 1;
        if (ii < intervals.length) cursor = intervals[ii].start;
      }
    }
    seg.overflow = rem;
  }
  return pieces;
}

export function dayLayout(state, di, wk = DEFAULT_WK()) {
  const { W0, W1 } = wakingWindow(state, di);
  const span = Math.max(1, W1 - W0);
  const bufferPct = state.settings.bufferPct;
  const repeat = state.settings.repeatCommitments;

  // Anchored commitments (non-sleep) within the waking window.
  const commitments = weekCommitments(state.commitments, di, wk, repeat)
    .filter((c) => !isSleep(c))
    .map((c) => {
      const { start, end } = commitmentSpan(c);
      return { id: c.id, label: c.label, top: clamp(start, W0, W1), bottom: clamp(end, W0, W1) };
    })
    .filter((c) => c.bottom - c.top > 0.5)
    .sort((a, b) => a.top - b.top);

  const dayTasks = weekTasks(state.tasks, di, wk, repeat);
  const anchored = dayTasks
    .filter((t) => t.start)
    .map((t) => {
      const s = toMinutes(t.start);
      return { task: t, top: clamp(s, W0, W1), bottom: clamp(s + (Number(t.hours) || 0) * 60, W0, W1) };
    })
    .filter((a) => a.bottom - a.top > 0.5)
    .sort((a, b) => a.top - b.top);
  const floating = dayTasks
    .filter((t) => !t.start)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'floor' ? -1 : 1));

  // Free time = waking minus commitments (anchored tasks live inside this free time).
  const free = [];
  let pos = W0;
  for (const c of commitments) {
    if (c.top > pos) free.push({ start: pos, end: c.top });
    pos = Math.max(pos, c.bottom);
  }
  if (pos < W1) free.push({ start: pos, end: W1 });

  const freeMin = free.reduce((a, iv) => a + (iv.end - iv.start), 0);
  const bufferMin = freeMin * bufferPct;
  const schedulableMin = Math.max(0, freeMin - bufferMin);

  // Buffer band at the bottom of free time; floating tasks flow into what's left
  // after the anchored tasks are carved out.
  const tracks = carveBuffer(free, bufferMin);
  const anchoredRanges = anchored.map((a) => ({ start: a.top, end: a.bottom }));
  const flowIntervals = subtractRanges(tracks, anchoredRanges);

  const segs = floating.map((t) => ({
    taskId: t.id,
    minutes: (Number(t.hours) || 0) * 60,
    color: categoryColor(state.priorities, t.categoryId),
    label: t.title,
    hours: Number(t.hours) || 0,
  }));
  const taskPieces = flow(flowIntervals, segs);

  const plannedMin = dayTasks.reduce((a, t) => a + (Number(t.hours) || 0) * 60, 0);

  // Render blocks (positions in minutes; the component scales to px).
  const blocks = [];
  for (const iv of tracks) blocks.push({ type: iv.kind === 'buffer' ? 'buffer' : 'free', top: iv.start, height: iv.end - iv.start });
  for (const c of commitments)
    blocks.push({ type: 'commitment', id: c.id, top: c.top, height: c.bottom - c.top, label: c.label, hours: (c.bottom - c.top) / 60, color: FIXED_COLOR });
  for (const a of anchored)
    blocks.push({
      type: 'task',
      taskId: a.task.id,
      anchored: true,
      first: true,
      top: a.top,
      height: a.bottom - a.top,
      label: a.task.title,
      hours: Number(a.task.hours) || 0,
      color: categoryColor(state.priorities, a.task.categoryId),
    });
  for (const p of taskPieces)
    blocks.push({
      type: 'task',
      taskId: p.seg.taskId,
      anchored: false,
      first: p.first,
      top: p.start,
      height: p.end - p.start,
      label: p.first ? p.seg.label : '',
      hours: p.first ? p.seg.hours : null,
      color: p.seg.color,
      overloaded: p.kind === 'buffer',
    });

  const overloadedMin = Math.max(0, plannedMin - schedulableMin);
  const marks = [];
  for (let m = Math.ceil(W0 / 60) * 60; m <= W1; m += 120) marks.push(m);

  return {
    W0,
    W1,
    span,
    blocks,
    marks,
    freeMin,
    bufferMin,
    schedulableMin,
    plannedMin,
    overloadedMin,
    spareMin: schedulableMin - plannedMin,
  };
}

// Per-category planned minutes for a day, for the colour-coded overview bar.
export function dayBreakdown(state, di, wk = DEFAULT_WK()) {
  const byCat = new Map();
  const repeat = state.settings.repeatCommitments;
  for (const t of weekTasks(state.tasks, di, wk, repeat)) {
    const min = (Number(t.hours) || 0) * 60;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) || 0) + min);
  }
  return [...byCat.entries()].map(([categoryId, minutes]) => ({
    categoryId,
    minutes,
    color: categoryColor(state.priorities, categoryId),
  }));
}

// "3h spare" / "Full" / "Overloaded by 2h" from a leftover-hours number.
export function spareLabel(hoursLeft) {
  const r = Math.round(hoursLeft * 10) / 10;
  if (r > 0.05) return `${r % 1 === 0 ? r : r.toFixed(1)}h spare`;
  if (r < -0.05) {
    const o = Math.abs(r);
    return `Overloaded by ${o % 1 === 0 ? o : o.toFixed(1)}h`;
  }
  return 'Full';
}
