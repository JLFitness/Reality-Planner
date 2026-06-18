import { useState } from 'react';
import { useStore } from '../store.jsx';
import { DAYS, fromISO, todayISO, addDaysISO, weekKey, mondayOf, weekDates } from '../lib/time.js';
import { weekSummary, floorStreak, targetActuals } from '../lib/scoring.js';
import { Card, Empty } from '../components/ui.jsx';
import BarChart, { LineChart } from '../components/Chart.jsx';

export default function Review() {
  const { state, actions } = useStore();
  const [anchor, setAnchor] = useState(todayISO());

  const summary = weekSummary(state, anchor);
  const streak = floorStreak(state);
  const actuals = targetActuals(state, anchor);
  const wk = weekKey(fromISO(anchor));
  const note = state.reviews[wk] || '';

  const mon = mondayOf(fromISO(anchor));
  const sun = addDaysISO(weekKey(fromISO(anchor)), 6);
  const label = `${mon.getDate()}/${mon.getMonth() + 1} – ${fromISO(sun).getDate()}/${
    fromISO(sun).getMonth() + 1
  }`;
  const isThisWeek = weekKey(fromISO(anchor)) === weekKey(new Date());

  // Trend: last 8 weeks ending at the viewed week.
  const trend = [];
  for (let i = 7; i >= 0; i -= 1) {
    const a = addDaysISO(anchor, -7 * i);
    const s = weekSummary(state, a);
    const m = mondayOf(fromISO(a));
    trend.push({ label: `${m.getDate()}/${m.getMonth() + 1}`, summary: s, weight: weekWeightAvg(state, a) });
  }

  // Weight: each day this week + the week's average.
  const dayWeights = summary.dates.map((iso) => state.log[iso]?.weight);
  const presentWeights = dayWeights.filter((w) => typeof w === 'number');
  const weightAvg = presentWeights.length
    ? Math.round((presentWeights.reduce((a, b) => a + b, 0) / presentWeights.length) * 10) / 10
    : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={() => setAnchor(addDaysISO(anchor, -7))}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-lg font-bold">{isThisWeek ? 'This week' : 'Week of'}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
        <button
          onClick={() => setAnchor(addDaysISO(anchor, 7))}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300"
        >
          ›
        </button>
      </header>

      {/* streak + week avg */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <div className="text-3xl font-extrabold text-amber-400">{streak}🔥</div>
          <div className="text-xs text-slate-400">Floor-hit streak</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-extrabold text-emerald-400">{summary.avg}%</div>
          <div className="text-xs text-slate-400">
            Week average {summary.activeDays > 0 ? `(${summary.activeDays}d)` : ''}
          </div>
        </Card>
      </div>

      {/* per-day scores */}
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Daily scores</h2>
        <div className="space-y-2">
          {summary.scored.map((s, i) => (
            <div key={s.iso} className="flex items-center gap-2 text-sm">
              <span className="w-9 shrink-0 text-slate-400">{DAYS[i]}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full ${
                    !s.hasItems ? 'bg-slate-700' : s.floorMet ? 'bg-emerald-500' : 'bg-rose-500/70'
                  }`}
                  style={{ width: `${Math.min(100, (s.score / 150) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right">
                {s.hasItems ? (
                  <>
                    <span className={s.floorMet ? 'text-emerald-400' : 'text-slate-300'}>{s.score}%</span>
                    {s.floorMet && <span className="ml-1 text-emerald-400">✓</span>}
                  </>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* targets vs actuals */}
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">Targets vs done</h2>
        {actuals.length === 0 ? (
          <Empty>Add weekly targets in the Planner.</Empty>
        ) : (
          <div className="space-y-3">
            {actuals.map((t) => (
              <TargetRow
                key={t.id}
                label={t.label || 'Untitled'}
                done={t.done}
                target={t.target}
                ceiling={t.ceiling}
                unit={t.metric === 'hours' ? 'h' : ''}
                hint={`${t.categoryName} · ${t.metric}`}
              />
            ))}
          </div>
        )}
      </Card>

      {/* trends */}
      <Card className="p-4">
        <h2 className="mb-1 font-semibold">Trends</h2>
        <p className="mb-2 text-xs text-slate-500">Weekly average score (last 8 weeks)</p>
        <BarChart
          data={trend.map((t) => ({
            label: t.label,
            value: t.summary.avg,
            muted: t.summary.activeDays === 0,
          }))}
          max={150}
          unit="%"
          accent="#34d399"
        />
        <p className="mb-2 mt-3 text-xs text-slate-500">Floor-hit consistency</p>
        <BarChart
          data={trend.map((t) => ({
            label: t.label,
            value: t.summary.floorRate,
            muted: t.summary.activeDays === 0,
          }))}
          max={100}
          unit="%"
          accent="#fbbf24"
        />
      </Card>

      {/* weight */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Weight</h2>
          {weightAvg != null && <span className="text-sm text-slate-400">avg {weightAvg}</span>}
        </div>
        <div className="space-y-2">
          {summary.dates.map((iso, i) => {
            const w = dayWeights[i];
            return (
              <div key={iso} className="flex items-center gap-2 text-sm">
                <span className="w-9 shrink-0 text-slate-400">{DAYS[i]}</span>
                <div className="h-px flex-1 bg-slate-800/60" />
                <span className={typeof w === 'number' ? 'font-medium text-slate-200' : 'text-slate-600'}>
                  {typeof w === 'number' ? w : '—'}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mb-1 mt-4 text-xs text-slate-500">Weekly average (last 8 weeks)</p>
        {trend.filter((t) => t.weight != null).length >= 2 ? (
          <LineChart data={trend.map((t) => ({ label: t.label, value: t.weight }))} />
        ) : (
          <p className="py-3 text-center text-sm text-slate-500">
            Keep logging your weight — the trend appears once you have two or more weeks.
          </p>
        )}
      </Card>

      {/* reflection */}
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
          {unit} / {target}
          {ceiling ? `–${ceiling}` : ''}
          {unit}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full ${hitFloor ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function weekWeightAvg(state, anyISO) {
  const vals = weekDates(fromISO(anyISO))
    .map((iso) => state.log[iso]?.weight)
    .filter((w) => typeof w === 'number');
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function round(n) {
  return Math.round(n * 10) / 10;
}
