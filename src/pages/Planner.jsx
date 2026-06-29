import { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import {
  DAYS,
  DAY_LONG,
  dayIndex,
  hrs,
  prettyClock,
  toMinutes,
  todayISO,
  addDaysISO,
  weekKey,
  fromISO,
  mondayOf,
} from '../lib/time.js';
import { plannerStats, cutSuggestions } from '../lib/planner.js';
import { weekCommitments, isSleep, dedupeTasks } from '../lib/week.js';
import { dayBreakdown, spareLabel } from '../lib/timeline.js';
import { categoryColor, tint, FIXED_COLOR } from '../lib/colors.js';
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
  const { state, actions } = useStore();
  // Which week we're planning. `wk` is that week's Monday ISO.
  const [weekAnchor, setWeekAnchor] = useState(todayISO());
  const wk = weekKey(fromISO(weekAnchor));
  const isThisWeek = wk === weekKey(new Date());
  const stats = plannerStats(state, wk);
  const [selectedDay, setSelectedDay] = useState(dayIndex(new Date()));
  // pending = a template waiting to be tapped onto a day: { kind:'task'|'commitment', id }
  const [pending, setPending] = useState(null);
  // Touch drag of a library item onto a day. (Mouse uses native HTML5 DnD.)
  // { kind, id, name, color, x, y, overDi }
  const [libDrag, setLibDrag] = useState(null);
  const libDraggedRef = useRef(false);

  const startLibDrag = (e, item) => {
    if (e.pointerType !== 'touch') return; // desktop keeps HTML5 drag-and-drop
    const startX = e.clientX;
    const startY = e.clientY;
    libDraggedRef.current = false;
    let active = false;

    // Which day (bar or board) is under the finger, if any and not locked.
    const dayUnder = (x, y) => {
      const zone = document.elementFromPoint(x, y)?.closest('[data-drop-day]');
      if (!zone || zone.dataset.dropPast === '1') return null;
      return Number(zone.dataset.dropDay);
    };

    const move = (ev) => {
      if (!active) {
        if (Math.abs(ev.clientX - startX) < 6 && Math.abs(ev.clientY - startY) < 6) return;
        active = true;
        libDraggedRef.current = true;
      }
      setLibDrag({ ...item, x: ev.clientX, y: ev.clientY, overDi: dayUnder(ev.clientX, ev.clientY) });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (active) {
        const di = dayUnder(ev.clientX, ev.clientY);
        if (di != null) {
          if (item.kind === 'task') actions.addTaskFromTemplate(item.id, di, null, wk);
          else actions.addCommitmentFromTemplate(item.id, di, null, wk);
          setSelectedDay(di);
        }
      }
      setLibDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="space-y-4 anim-fade-in">
      <header>
        <h1 className="text-2xl font-bold">Weekly Planner</h1>
        <p className="text-sm text-slate-400">Plan a week you can actually live.</p>
      </header>

      <WeekNav
        wk={wk}
        isThisWeek={isThisWeek}
        onPrev={() => setWeekAnchor(addDaysISO(weekAnchor, -7))}
        onNext={() => setWeekAnchor(addDaysISO(weekAnchor, 7))}
        onCopyNext={() => {
          actions.copyWeekToNext(wk);
          setWeekAnchor(addDaysISO(weekAnchor, 7));
        }}
      />

      <Headline stats={stats} isThisWeek={isThisWeek} />
      <Cuts wk={wk} />

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
              wk={wk}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              pending={pending}
              setPending={setPending}
              libDragOverDi={libDrag?.overDi}
            />
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
              <Library kind="task" pending={pending} setPending={setPending} startLibDrag={startLibDrag} draggedRef={libDraggedRef} />
              <Library kind="commitment" pending={pending} setPending={setPending} startLibDrag={startLibDrag} draggedRef={libDraggedRef} />
            </div>
          </Panel>
        </div>

        {/* The day board — pinned beside the controls on desktop */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-16">
          <DayCard di={selectedDay} stats={stats} wk={wk} dragHighlight={libDrag?.overDi === selectedDay} />
        </div>

        <div className="space-y-4 lg:col-start-1 lg:row-start-2">
          <Panel collapsible persistKey="planner-commitments" title="Fixed commitments" subtitle="Immovable blocks: work, meals, training">
            <Commitments wk={wk} />
          </Panel>
          <Panel collapsible persistKey="planner-tasks" title="This week's tasks" subtitle="Tap a row for duration & notes">
            <Tasks selectedDay={selectedDay} wk={wk} />
          </Panel>
        </div>
      </div>

      {/* Finger-following preview while dragging a library item (touch). */}
      {libDrag && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-xl border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 shadow-xl"
          style={{ left: libDrag.x, top: libDrag.y, transform: 'translate(-50%, -130%)' }}
        >
          {libDrag.kind === 'task' ? <Dot color={libDrag.color} /> : <span>🔒</span>}
          {libDrag.name}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- week nav */

function WeekNav({ wk, isThisWeek, onPrev, onNext, onCopyNext }) {
  const mon = fromISO(wk);
  const sun = fromISO(addDaysISO(wk, 6));
  const label = `${mon.getDate()}/${mon.getMonth() + 1} – ${sun.getDate()}/${sun.getMonth() + 1}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <IconBtn aria-label="Previous week" onClick={onPrev}>
          ‹
        </IconBtn>
        <div className="text-center">
          <div className="text-sm font-bold">{isThisWeek ? 'This week' : 'Week of'}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
        <IconBtn aria-label="Next week" onClick={onNext}>
          ›
        </IconBtn>
      </div>
      <button
        onClick={onCopyNext}
        title="Copy this week's plan into next week"
        className="group flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 active:scale-[.99]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
        Copy this week to next
        <span className="transition group-hover:translate-x-0.5">→</span>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- headline */

function Headline({ stats, isThisWeek }) {
  const r = RATING_STYLE[stats.rating];
  const room = stats.remaining.leftover;
  const overloaded = room < -0.05;
  const restOfWeek = isThisWeek && stats.days.some((d) => d.past);
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

function Cuts({ wk }) {
  const { state, actions } = useStore();
  const { cuts, freed, enough } = cutSuggestions(state, wk);
  if (!cuts.length) return null;
  return (
    <Card className="border border-rose-500/40 bg-rose-500/5 p-4">
      <div className="font-semibold text-rose-300">Overloaded — suggested cuts</div>
      <p className="mt-0.5 text-xs text-slate-400">
        From the bottom of your priorities up. Golden &amp; mandatory items are never cut.
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
            <Btn variant="danger" onClick={() => actions.removeTaskLike(t.id)} className="!min-h-9 !px-3">
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

function WeekOverview({ stats, wk, selectedDay, setSelectedDay, pending, setPending, libDragOverDi }) {
  const { state, actions } = useStore();
  const [dragDay, setDragDay] = useState(null);

  const place = (di) => {
    if (pending?.kind === 'task') actions.addTaskFromTemplate(pending.id, di, null, wk);
    else if (pending?.kind === 'commitment') actions.addCommitmentFromTemplate(pending.id, di, null, wk);
    setPending(null);
    setSelectedDay(di);
  };

  const onDrop = (e, di) => {
    e.preventDefault();
    const tt = e.dataTransfer.getData('text/tasktpl');
    const ct = e.dataTransfer.getData('text/cmttpl');
    if (tt) actions.addTaskFromTemplate(tt, di, null, wk);
    else if (ct) actions.addCommitmentFromTemplate(ct, di, null, wk);
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
        const segs = dayBreakdown(state, d.di, wk);
        const committedMin = d.committed * 60;
        const taskMin = d.planned * 60;
        // The bar represents the whole waking window, so fixed commitments (grey)
        // and tasks (category colours) both show how full the day is.
        const wakingMin = (d.committed + d.free) * 60;
        const scaleMax = Math.max(wakingMin, committedMin + taskMin, 1);
        // Marker = the point past which you'd eat into your protected buffer.
        const fullPct = Math.min(100, ((committedMin + d.available * 60) / scaleMax) * 100);
        const active = selectedDay === d.di;
        const over = d.leftover < -0.05;
        const past = d.past;
        return (
          <button
            key={d.di}
            data-drop-day={d.di}
            data-drop-past={past ? '1' : '0'}
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
            } ${dragDay === d.di || libDragOverDi === d.di ? 'ring-2 ring-emerald-400' : ''} ${
              past ? 'opacity-50' : ''
            }`}
          >
            <span className="w-8 shrink-0 text-xs font-medium text-slate-300">{d.name}</span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <span className="flex h-full">
                {committedMin > 0 && (
                  <span
                    className="transition-[width] duration-500 ease-out"
                    style={{ width: `${(committedMin / scaleMax) * 100}%`, backgroundColor: FIXED_COLOR }}
                  />
                )}
                {segs.map((sg) => (
                  <span
                    key={sg.categoryId}
                    className="transition-[width] duration-500 ease-out"
                    style={{ width: `${(sg.minutes / scaleMax) * 100}%`, backgroundColor: sg.color }}
                  />
                ))}
              </span>
              {!past && (
                <span
                  className="absolute top-0 h-full w-px bg-slate-400/60"
                  style={{ left: `${fullPct}%` }}
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

function Library({ kind, pending, setPending, startLibDrag, draggedRef }) {
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
                onPointerDown={(e) => startLibDrag(e, { kind, id: t.id, name: t.name || 'Untitled', color })}
                onClick={() => {
                  // Ignore the click the browser fires at the end of a touch drag.
                  if (draggedRef.current) {
                    draggedRef.current = false;
                    return;
                  }
                  setPending(sel ? null : { kind, id: t.id });
                }}
                className={`flex touch-none items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
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
                      ? ` · ${t.kind === 'floor' ? 'Mandatory' : 'Bonus'}${t.countable ? ' · countable' : ''}`
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

function DayCard({ di, stats, wk, dragHighlight = false }) {
  const { state } = useStore();
  const d = stats.days[di];
  const over = d.leftover < -0.05;
  const past = d.past;
  const repeat = state.settings.repeatCommitments;
  const hasItems =
    state.tasks.some((t) => t.day === di && (repeat || t.weekStart === wk)) ||
    weekCommitments(state.commitments, di, wk, repeat).some((c) => !isSleep(c));
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
        <DayBoard di={di} interactive={!past} dragHighlight={dragHighlight} weekStart={wk} />
      ) : (
        <div data-drop-day={di} data-drop-past={past ? '1' : '0'}>
          <Empty>
            {past
              ? 'This day has passed — nothing was planned.'
              : 'Nothing on this day yet — drag a task or commitment onto it above.'}
          </Empty>
        </div>
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
      <span className="flex items-center gap-1">
        <Dot color={FIXED_COLOR} />
        Commitments
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- commitments */

function Commitments({ wk }) {
  const { state, actions } = useStore();
  const today = todayISO();
  const repeat = state.settings.repeatCommitments;
  // First day of the viewed week that hasn't passed (-1 = whole week is in the past).
  const minDay = DAYS.findIndex((_, di) => addDaysISO(wk, di) >= today);
  const [label, setLabel] = useState('');
  const [day, setDay] = useState(dayIndex(new Date()));
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');

  const add = () => {
    if (!label.trim() || addDaysISO(wk, Number(day)) < today) return;
    actions.addCommitment({ label: label.trim(), day: Number(day), start, end, weekStart: wk });
    setLabel('');
  };

  const list = state.commitments
    .filter((c) => !isSleep(c) && (repeat || c.weekStart === wk))
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

  return (
    <div className="space-y-3">
      <TextInput placeholder="e.g. Work shift, Lunch" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Day</Label>
          <DaySelect value={day} onChange={setDay} fromIdx={minDay === -1 ? 7 : minDay} />
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
            const past = addDaysISO(wk, c.day) < today;
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

function Tasks({ selectedDay, wk }) {
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
      weekStart: wk,
    });
    setTitle('');
    setHours('1');
  };

  const today = todayISO();
  const repeat = state.settings.repeatCommitments;
  const filtered = state.tasks.filter((t) => repeat || t.weekStart === wk);
  const tasks = (repeat ? dedupeTasks(filtered) : filtered).sort((a, b) => a.day - b.day);
  const addPast = addDaysISO(wk, selectedDay) < today;

  return (
    <div className="space-y-3">
      {tasks.length === 0 ? (
        <Empty>No tasks yet. Pull from the library or add one below.</Empty>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const isOpen = !!open[t.id];
            const past = addDaysISO(wk, t.day) < today;

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
                          {t.kind === 'floor' ? 'Mandatory' : 'Bonus'}
                        </span>
                      </span>
                    </span>
                  </button>
                  <IconBtn aria-label="Delete" onClick={() => actions.removeTaskLike(t.id)}>
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
                          {t.kind === 'floor' ? 'Mandatory' : 'Bonus'}
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
              <option value="floor">Mandatory</option>
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
