import { useState } from 'react';
import { useStore } from '../store.jsx';
import {
  DAYS,
  MONTHS,
  fromISO,
  toISO,
  todayISO,
  addDaysISO,
  addMonthsISO,
  weekKey,
  weekDates,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  monthLabel,
  yearOf,
} from '../lib/time.js';
import { dayScore, floorStreak, rangeStats, weightAvgRange, targetActualsRange } from '../lib/scoring.js';
import { Card, Empty } from '../components/ui.jsx';
import BarChart, { LineChart } from '../components/Chart.jsx';

const RANGES = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

// Build everything the page shows for the chosen range + anchor: the bucketed
// series (days / weeks / months), the period label, and the from–to window.
function reviewView(state, range, anchor) {
  if (range === 'week') {
    const from = weekKey(fromISO(anchor));
    const to = addDaysISO(from, 6);
    const buckets = weekDates(fromISO(from)).map((iso, i) => {
      const s = dayScore(state, iso);
      return {
        label: DAYS[i],
        score: s.hasItems ? s.score : 0,
        muted: !s.hasItems,
        rate: s.floorMet ? 100 : 0,
        weight: state.log[iso]?.weight ?? null,
      };
    });
    const isCurrent = from === weekKey(new Date());
    const mon = fromISO(from);
    const sun = fromISO(to);
    const label = isCurrent
      ? 'This week'
      : `${mon.getDate()}/${mon.getMonth() + 1} – ${sun.getDate()}/${sun.getMonth() + 1}`;
    return { from, to, buckets, label, weeks: 1, unit: 'Week' };
  }

  if (range === 'month') {
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    const buckets = [];
    let wkMon = weekKey(fromISO(from));
    while (wkMon <= to) {
      const wEnd = addDaysISO(wkMon, 6);
      const rs = rangeStats(state, wkMon, wEnd);
      const d = fromISO(wkMon);
      buckets.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        score: rs.avg,
        muted: rs.activeDays === 0,
        rate: rs.mandatoryRate,
        weight: weightAvgRange(state, wkMon, wEnd),
      });
      wkMon = addDaysISO(wkMon, 7);
    }
    const isCurrent = startOfMonth(anchor) === startOfMonth(todayISO());
    return { from, to, buckets, label: `${isCurrent ? 'This month · ' : ''}${monthLabel(anchor)}`, weeks: buckets.length, unit: 'Month' };
  }

  // year — 12 monthly buckets, no navigation between years
  const from = startOfYear(anchor);
  const to = endOfYear(anchor);
  const y = yearOf(anchor);
  const buckets = MONTHS.map((m, mi) => {
    const mFrom = toISO(new Date(y, mi, 1));
    const mTo = toISO(new Date(y, mi + 1, 0));
    const rs = rangeStats(state, mFrom, mTo);
    return {
      label: m,
      score: rs.avg,
      muted: rs.activeDays === 0,
      rate: rs.mandatoryRate,
      weight: weightAvgRange(state, mFrom, mTo),
    };
  });
  const isCurrent = y === new Date().getFullYear();
  return { from, to, buckets, label: `${isCurrent ? 'This year · ' : ''}${y}`, weeks: 52, unit: 'Year' };
}

export default function Review() {
  const { state, actions } = useStore();
  const [range, setRange] = useState('week');
  const [anchor, setAnchor] = useState(todayISO());

  const view = reviewView(state, range, anchor);
  const summary = rangeStats(state, view.from, view.to);
  const streak = floorStreak(state);
  const periodWeight = weightAvgRange(state, view.from, view.to);
  const actuals = targetActualsRange(state, view.from, view.to);

  const wk = weekKey(fromISO(anchor));
  const note = state.reviews[wk] || '';

  const step = (dir) => {
    if (range === 'week') setAnchor(addDaysISO(anchor, dir * 7));
    else if (range === 'month') setAnchor(addMonthsISO(anchor, dir));
  };
  const changeRange = (r) => {
    setRange(r);
    setAnchor(todayISO());
  };

  const weightSeries = view.buckets.map((b) => ({ label: b.label, value: b.weight }));
  const enoughWeight = weightSeries.filter((w) => w.value != null).length >= 2;

  return (
    <div className="space-y-4 stagger">
      {/* range selector */}
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => changeRange(r.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              range === r.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* period nav (no arrows for year) */}
      <header className="flex items-center justify-between">
        {range === 'year' ? (
          <span className="h-11 w-11" />
        ) : (
          <button
            onClick={() => step(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300"
          >
            ‹
          </button>
        )}
        <div className="text-center text-lg font-bold">{view.label}</div>
        {range === 'year' ? (
          <span className="h-11 w-11" />
        ) : (
          <button
            onClick={() => step(1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300"
          >
            ›
          </button>
        )}
      </header>

      {/* streak + period average */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <div className="text-3xl font-extrabold text-amber-400">{streak}🔥</div>
          <div className="text-xs text-slate-400">Mandatory streak</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-extrabold text-emerald-400">{summary.avg}%</div>
          <div className="text-xs text-slate-400">
            {view.unit} average {summary.activeDays > 0 ? `(${summary.activeDays}d)` : ''}
          </div>
        </Card>
      </div>

      {/* score */}
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Score</h2>
        <p className="mb-2 text-xs text-slate-500">
          {range === 'week' ? 'Daily score' : range === 'month' ? 'Weekly average' : 'Monthly average'}
        </p>
        {summary.activeDays === 0 ? (
          <Empty>Nothing scored in this {range}.</Empty>
        ) : (
          <BarChart data={view.buckets.map((b) => ({ label: b.label, value: b.score, muted: b.muted }))} max={150} unit="%" />
        )}
      </Card>

      {/* mandatory consistency */}
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Mandatory consistency</h2>
        <p className="mb-2 text-xs text-slate-500">
          {range === 'week' ? 'Days you hit 100%' : 'Share of active days at 100%'}
        </p>
        {summary.activeDays === 0 ? (
          <Empty>Nothing scored in this {range}.</Empty>
        ) : (
          <BarChart
            data={view.buckets.map((b) => ({ label: b.label, value: b.rate, muted: b.muted }))}
            max={100}
            unit="%"
            accent="#fbbf24"
          />
        )}
      </Card>

      {/* targets vs done (scaled to the period's number of weeks) */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Targets vs done</h2>
          {view.weeks > 1 && <span className="text-xs text-slate-500">× {view.weeks} weeks</span>}
        </div>
        {actuals.length === 0 ? (
          <Empty>Add weekly targets in Setup.</Empty>
        ) : (
          <div className="space-y-3">
            {actuals.map((t) => (
              <TargetRow
                key={t.id}
                label={t.label || 'Untitled'}
                done={t.done}
                target={(t.target || 0) * view.weeks}
                ceiling={t.ceiling ? t.ceiling * view.weeks : null}
                unit={t.metric === 'hours' ? 'h' : ''}
                hint={`${t.categoryName} · ${t.metric}`}
              />
            ))}
          </div>
        )}
      </Card>

      {/* weight */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Weight</h2>
          {periodWeight != null && <span className="text-sm text-slate-400">avg {periodWeight}</span>}
        </div>
        {enoughWeight ? (
          <LineChart data={weightSeries} />
        ) : (
          <p className="py-3 text-center text-sm text-slate-500">
            Keep logging your weight — the trend appears once you have two or more points.
          </p>
        )}
      </Card>

      {/* reflection (weekly journal) */}
      {range === 'week' && (
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Reflection</h2>
          <textarea
            value={note}
            onChange={(e) => actions.setReviewNote(wk, e.target.value)}
            placeholder="What worked, what slipped, what to change next week…"
            rows={4}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </Card>
      )}

      {state.tasks.length === 0 && <Empty>Plan a week to start tracking progress.</Empty>}
    </div>
  );
}

function TargetRow({ label, done, target, ceiling, unit = '', hint }) {
  const goal = ceiling || target || 1;
  const pct = Math.min(100, (done / goal) * 100);
  const hitFloor = done >= target;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">
          {label}
          {hint && <span className="ml-2 text-xs text-slate-500">{hint}</span>}
        </span>
        <span className={hitFloor ? 'font-semibold text-emerald-400' : 'text-slate-300'}>
          {round(done)}
          {unit} / {round(target)}
          {ceiling ? `–${round(ceiling)}` : ''}
          {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-[width] duration-700 ease-out ${hitFloor ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function round(n) {
  return Math.round(n * 10) / 10;
}
