import { useState } from 'react';
import { useStore } from '../store.jsx';
import { DAYS, DAY_LONG, dayIndex, hrs, prettyClock, toMinutes } from '../lib/time.js';
import { plannerStats, cutSuggestions } from '../lib/planner.js';
import { dayBreakdown, spareLabel } from '../lib/timeline.js';
import { categoryColor, tint } from '../lib/colors.js';
import DayBoard from '../components/DayTimeline.jsx';
import {
  Card,
  Panel,
  Btn,
  IconBtn,
  TextInput,
  NumberInput,
  Select,
  Label,
  Pill,
  Empty,
} from '../components/ui.jsx';

const RATING_STYLE = {
  Comfortable: { text: 'text-emerald-400', ring: 'border-emerald-500/40 bg-emerald-500/10' },
  Tight: { text: 'text-amber-400', ring: 'border-amber-500/40 bg-amber-500/10' },
  Overloaded: { text: 'text-rose-400', ring: 'border-rose-500/40 bg-rose-500/10' },
};

export default function Planner() {
  const { state } = useStore();
  const stats = plannerStats(state);
  const [selectedDay, setSelectedDay] = useState(dayIndex(new Date()));
  // pending = a template waiting to be tapped onto a day: { kind:'task'|'commitment', id }
  const [pending, setPending] = useState(null);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Weekly Planner</h1>
        <p className="text-sm text-slate-400">Plan a week you can actually live.</p>
      </header>

      <Headline stats={stats} />
      <Cuts />

      {/* Desktop: pick days & pull from libraries on the left, day board pinned on
          the right so it stays in view. Mobile: everything stacks in order. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="lg:col-start-1 lg:row-start-1">
          <Panel
            title="Your week"
            subtitle="Tap a day to open it. Drag a saved item onto a day — or tap it, then tap a day."
          >
            <WeekOverview
              stats={stats}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              pending={pending}
              setPending={setPending}
            />
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
              <Library kind="task" pending={pending} setPending={setPending} />
              <Library kind="commitment" pending={pending} setPending={setPending} />
            </div>
          </Panel>
        </div>

        {/* The day board — pinned beside the controls on desktop */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-16">
          <DayCard di={selectedDay} stats={stats} />
        </div>

        <div className="space-y-4 lg:col-start-1 lg:row-start-2">
          <Panel collapsible persistKey="planner-commitments" title="Fixed commitments" subtitle="Immovable blocks: work, meals, training">
            <Commitments />
          </Panel>
          <Panel collapsible persistKey="planner-tasks" title="This week's tasks" subtitle="Tap a row for duration & notes">
            <Tasks selectedDay={selectedDay} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- headline */

function Headline({ stats }) {
  const r = RATING_STYLE[stats.rating];
  const room = stats.remaining.leftover;
  const overloaded = room < -0.05;
  const restOfWeek = stats.todayIdx > 0;
  return (
    <Card className={`border p-5 ${r.ring}`}>
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {restOfWeek ? 'Rest of this week is' : 'This week is'}
      </div>
      <div className={`text-4xl font-extrabold ${r.text}`}>{stats.rating}</div>
      <div className="mt-3">
        <div className={`text-3xl font-bold ${overloaded ? 'text-rose-400' : 'text-sky-300'}`}>
          {overloaded ? `Overloaded by ${hrs(Math.abs(room))}h` : `${hrs(room)}h breathing room`}
        </div>
        <div className="text-xs text-slate-500">
          spare time {restOfWeek ? 'across the days left' : 'this week'}, after commitments, tasks &amp;
          your {Math.round(stats.bufferPct * 100)}% safety net
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- cuts */

function Cuts() {
  const { state, actions } = useStore();
  const { cuts, freed, enough } = cutSuggestions(state);
  if (!cuts.length) return null;
  return (
    <Card className="border border-rose-500/40 bg-rose-500/5 p-4">
      <div className="font-semibold text-rose-300">Overloaded — suggested cuts</div>
      <p className="mt-0.5 text-xs text-slate-400">
        From the bottom of your priorities up. Golden &amp; floor items are never cut.
      </p>
      <ul className="mt-3 space-y-2">
        {cuts.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <Dot color={categoryColor(state.priorities, t.categoryId)} />
              {t.title}
              <span className="text-xs text-slate-500">
                {catName(state, t.categoryId)} · {hrs(t.hours)}h
              </span>
            </span>
            <Btn variant="danger" onClick={() => actions.removeTask(t.id)} className="!min-h-9 !px-3">
              Cut
            </Btn>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs text-slate-400">
        Cutting these frees <span className="font-semibold text-slate-200">{hrs(freed)}h</span>.{' '}
        {enough ? 'That brings the week back to realistic.' : 'Still tight after every bonus is cut.'}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ week overview */

function WeekOverview({ stats, selectedDay, setSelectedDay, pending, setPending }) {
  const { state, actions } = useStore();
  const [dragDay, setDragDay] = useState(null);

  const place = (di) => {
    if (pending?.kind === 'task') actions.addTaskFromTemplate(pending.id, di);
    else if (pending?.kind === 'commitment') actions.addCommitmentFromTemplate(pending.id, di);
    setPending(null);
    setSelectedDay(di);
  };

  const onDrop = (e, di) => {
    e.preventDefault();
    const tt = e.dataTransfer.getData('text/tasktpl');
    const ct = e.dataTransfer.getData('text/cmttpl');
    if (tt) actions.addTaskFromTemplate(tt, di);
    else if (ct) actions.addCommitmentFromTemplate(ct, di);
    if (tt || ct) setSelectedDay(di);
    setDragDay(null);
  };

  return (
    <div className="space-y-1.5">
      {pending && (
        <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-center text-xs text-emerald-300">
          Tap a day to add it
        </div>
      )}
      {stats.days.map((d) => {
        const segs = dayBreakdown(state, d.di);
        const planned = d.planned * 60;
        const scaleMax = Math.max(d.available * 60, planned, 1);
        const active = selectedDay === d.di;
        const over = d.leftover < -0.05;
        const past = d.past;
        return (
          <button
            key={d.di}
            onClick={() => (past ? setSelectedDay(d.di) : place(d.di))}
            onDragOver={(e) => {
              if (past) return;
              e.preventDefault();
              setDragDay(d.di);
            }}
            onDragLeave={() => setDragDay((x) => (x === d.di ? null : x))}
            onDrop={(e) => {
              if (past) {
                e.preventDefault();
                return;
              }
              onDrop(e, d.di);
            }}
            title={past ? 'This day has passed — locked' : undefined}
            className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
              active ? 'border-slate-500 bg-slate-800/60' : 'border-transparent hover:bg-slate-800/40'
            } ${dragDay === d.di ? 'ring-2 ring-emerald-400' : ''} ${past ? 'opacity-50' : ''}`}
          >
            <span className="w-8 shrink-0 text-xs font-medium text-slate-300">{d.name}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <span className="flex h-full">
                {segs.map((sg) => (
                  <span key={sg.categoryId} style={{ width: `${(sg.minutes / scaleMax) * 100}%`, backgroundColor: sg.color }} />
                ))}
              </span>
              {!past && (
                <span
                  className="absolute top-0 h-full w-px bg-slate-400/60"
                  style={{ left: `${Math.min(100, ((d.available * 60) / scaleMax) * 100)}%` }}
                />
              )}
            </span>
            <span
              className={`w-24 shrink-0 text-right text-[11px] font-medium ${
                past ? 'text-slate-500' : over ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {past ? '🔒 Passed' : spareLabel(d.leftover)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- libraries */

function Library({ kind, pending, setPending }) {
  const { state } = useStore();
  const isTask = kind === 'task';
  const items = isTask ? state.templates : state.commitmentTemplates;
  const dndKey = isTask ? 'text/tasktpl' : 'text/cmttpl';
  const title = isTask ? 'Task library' : 'Commitment library';

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-slate-300">{title}</div>
      {items.length === 0 ? (
        <Empty>Create these on the Setup page.</Empty>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((t) => {
            const color = isTask ? categoryColor(state.priorities, t.categoryId) : '#64748b';
            const sel = pending?.kind === kind && pending.id === t.id;
            return (
              <button
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData(dndKey, t.id)}
                onClick={() => setPending(sel ? null : { kind, id: t.id })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  sel ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-700 hover:border-slate-500'
                }`}
                style={{ backgroundColor: tint(color, 0.14) }}
              >
                {isTask ? <Dot color={color} /> : <span className="text-slate-300">🔒</span>}
                <span>
                  <span className="font-medium">{t.name || 'Untitled'}</span>
                  <span className="block text-[11px] text-slate-400">
                    {hrs(t.hours)}h
                    {isTask
                      ? ` · ${t.kind === 'floor' ? 'Floor' : 'Bonus'}${t.countable ? ' · countable' : ''}`
                      : t.start
                        ? ` · ${t.start}`
                        : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- day card */

function DayCard({ di, stats }) {
  const { state } = useStore();
  const d = stats.days[di];
  const over = d.leftover < -0.05;
  const past = d.past;
  const hasItems =
    state.tasks.some((t) => t.day === di) ||
    state.commitments.some((c) => c.day === di && !/sleep/i.test(c.label || ''));
  return (
    <Panel title={DAY_LONG[di]} subtitle={`${hrs(d.committed)}h committed · ${hrs(d.planned)}h planned`}>
      <div className="mb-3 flex items-center justify-between">
        {past ? (
          <Pill className="bg-slate-700/50 text-slate-300">🔒 Passed — locked</Pill>
        ) : (
          <Pill className={over ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}>
            {spareLabel(d.leftover)}
          </Pill>
        )}
        <span className="text-xs text-slate-500">waking hours</span>
      </div>
      {hasItems ? (
        <DayBoard di={di} interactive={!past} />
      ) : (
        <Empty>
          {past
            ? 'This day has passed — nothing was planned.'
            : 'Nothing on this day yet — drag a task or commitment onto it above.'}
        </Empty>
      )}
      <Legend />
    </Panel>
  );
}

function Legend() {
  const { state } = useStore();
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
      {state.priorities.map((p) => (
        <span key={p.id} className="flex items-center gap-1">
          <Dot color={categoryColor(state.priorities, p.id)} />
          {p.name}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- commitments */

function Commitments() {
  const { state, actions } = useStore();
  const todayIdx = dayIndex(new Date());
  const [label, setLabel] = useState('');
  const [day, setDay] = useState(todayIdx);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');

  const add = () => {
    if (!label.trim() || Number(day) < todayIdx) return;
    actions.addCommitment({ label: label.trim(), day: Number(day), start, end });
    setLabel('');
  };

  const list = [...state.commitments]
    .filter((c) => !/sleep/i.test(c.label || ''))
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  return (
    <div className="space-y-3">
      <TextInput placeholder="e.g. Work shift, Lunch" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Day</Label>
          <DaySelect value={day} onChange={setDay} fromIdx={todayIdx} />
        </div>
        <div>
          <Label>Start</Label>
          <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <Label>End</Label>
          <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>
      <Btn variant="primary" className="w-full" onClick={add}>
        Add commitment
      </Btn>

      {list.length === 0 ? (
        <Empty>No commitments yet (sleep is set in Setup).</Empty>
      ) : (
        <ul className="divide-y divide-slate-800">
          {list.map((c) => {
            const past = c.day < todayIdx;
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-2 py-2 ${past ? 'opacity-60' : ''}`}
                title={past ? 'This day has passed — locked' : undefined}
              >
                <span className="text-sm">
                  <Pill className="mr-2 bg-slate-800 text-slate-300">{DAYS[c.day]}</Pill>
                  {c.label}
                  <span className="ml-2 text-xs text-slate-500">
                    {c.start}–{c.end}
                  </span>
                </span>
                {past ? (
                  <span className="px-2 text-slate-500">🔒</span>
                ) : (
                  <IconBtn aria-label="Delete" onClick={() => actions.removeCommitment(c.id)}>
                    ✕
                  </IconBtn>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- tasks */

function Tasks({ selectedDay }) {
  const { state, actions } = useStore();
  const [open, setOpen] = useState({});
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('1');
  const [categoryId, setCategoryId] = useState(state.priorities[0]?.id || '');
  const [kind, setKind] = useState('floor');

  const add = () => {
    if (!title.trim()) return;
    actions.addTask({
      title: title.trim(),
      hours: Number(hours) || 0,
      categoryId: categoryId || state.priorities[0]?.id,
      day: Number(selectedDay),
      kind,
      countable: false,
      notes: '',
      start: null,
    });
    setTitle('');
    setHours('1');
  };

  const tasks = [...state.tasks].sort((a, b) => a.day - b.day);
  const todayIdx = dayIndex(new Date());
  const addPast = selectedDay < todayIdx;

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <Empty>No tasks yet. Pull from the library or add one below.</Empty>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const isOpen = !!open[t.id];
            const past = t.day < todayIdx;

            // Past-day tasks are locked: read-only, no controls.
            if (past) {
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 opacity-60"
                  style={{ borderLeft: `3px solid ${categoryColor(state.priorities, t.categoryId)}` }}
                  title="This day has passed — locked"
                >
                  <Pill className="shrink-0 bg-slate-800 text-slate-400">{DAYS[t.day]}</Pill>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-300">{t.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {catName(state, t.categoryId)} · {hrs(t.hours)}h
                    </span>
                  </span>
                  <span className="text-slate-500">🔒</span>
                </li>
              );
            }

            return (
              <li
                key={t.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
                style={{ borderLeft: `3px solid ${categoryColor(state.priorities, t.categoryId)}` }}
              >
                <div className="flex items-center gap-2 p-2.5">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setOpen((o) => ({ ...o, [t.id]: !isOpen }))}
                  >
                    <Pill className="shrink-0 bg-slate-800 text-slate-300">{DAYS[t.day]}</Pill>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {t.title}
                        {t.start && (
                          <span className="ml-1 text-xs font-normal text-slate-400">
                            {prettyClock(toMinutes(t.start))}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {catName(state, t.categoryId)} · {hrs(t.hours)}h{t.countable ? ` · ×${t.target}` : ''}
                        {' · '}
                        <span className={t.kind === 'floor' ? 'text-emerald-400/80' : 'text-sky-400/80'}>
                          {t.kind === 'floor' ? 'Floor' : 'Bonus'}
                        </span>
                      </span>
                    </span>
                  </button>
                  <IconBtn aria-label="Delete" onClick={() => actions.removeTask(t.id)}>
                    ✕
                  </IconBtn>
                  <IconBtn
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    onClick={() => setOpen((o) => ({ ...o, [t.id]: !isOpen }))}
                  >
                    {isOpen ? '▾' : '▸'}
                  </IconBtn>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-slate-800 px-3 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Duration</span>
                        <NumberInput
                          step="0.25"
                          min="0"
                          value={t.hours}
                          onChange={(e) => actions.updateTask(t.id, { hours: Number(e.target.value) || 0 })}
                          className="w-20 text-center"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Type</span>
                        <button
                          onClick={() =>
                            actions.updateTask(t.id, { kind: t.kind === 'floor' ? 'ceiling' : 'floor' })
                          }
                          className={`min-h-9 rounded-lg px-3 text-xs font-medium ${
                            t.kind === 'floor'
                              ? 'bg-emerald-600/20 text-emerald-300'
                              : 'bg-sky-600/20 text-sky-300'
                          }`}
                        >
                          {t.kind === 'floor' ? 'Floor' : 'Bonus'}
                        </button>
                      </label>
                    </div>
                    <div>
                      <Label>Notes / instructions</Label>
                      <textarea
                        rows={3}
                        value={t.notes || ''}
                        onChange={(e) => actions.updateTask(t.id, { notes: e.target.value })}
                        placeholder="What to do in this session…"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* manual add — goes onto the day you're viewing */}
      {addPast ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center text-xs text-slate-500">
          🔒 {DAY_LONG[selectedDay]} has passed — locked, so you can't add to it.
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-xs font-medium text-slate-400">Add a one-off to {DAY_LONG[selectedDay]}</div>
          <TextInput placeholder="Task name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {state.priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="floor">Floor</option>
              <option value="ceiling">Bonus</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Hours</span>
            <NumberInput
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-20 text-center"
            />
            <Btn variant="primary" className="flex-1" onClick={add}>
              Add to {DAYS[selectedDay]}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- shared */

function DaySelect({ value, onChange, fromIdx = 0 }) {
  return (
    <Select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {DAYS.map((d, i) => (i < fromIdx ? null : (
        <option key={d} value={i}>
          {d}
        </option>
      )))}
    </Select>
  );
}

function Dot({ color }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

function catName(state, id) {
  return (state.priorities.find((p) => p.id === id) || {}).name || '—';
}
