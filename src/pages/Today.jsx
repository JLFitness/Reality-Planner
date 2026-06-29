import { useEffect, useRef, useState } from 'react';
import { useStore, useSync } from '../store.jsx';
import {
  DAYS,
  dayIndex,
  fromISO,
  todayISO,
  addDaysISO,
  prettyDate,
  prettyClock,
  toMinutes,
  hrs,
  weekKey,
} from '../lib/time.js';
import { dayScore, isTaskDone } from '../lib/scoring.js';
import { weekTasks, weekCommitments, isSleep } from '../lib/week.js';
import { categoryColor } from '../lib/colors.js';
import DayBoard from '../components/DayTimeline.jsx';
import { Card, Panel, Btn, IconBtn, NumberInput, Label, Select, Pill, Empty, Modal } from '../components/ui.jsx';

// Pick up to n distinct reward ids at random from the pool.
function pickRewards(pool, n = 3) {
  const ids = pool.map((r) => r.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(n, ids.length));
}

export default function Today() {
  const { state, actions } = useStore();
  const [iso, setIso] = useState(todayISO());
  const di = dayIndex(fromISO(iso));
  const wk = weekKey(fromISO(iso));
  const isToday = iso === todayISO();

  const dlog = state.log[iso] || { golden: {}, tasks: {} };
  const score = dayScore(state, iso);

  const dayTasks = weekTasks(state.tasks, di, wk, state.settings.repeatCommitments);
  const floorTasks = dayTasks.filter((t) => t.kind === 'floor');
  const ceilTasks = dayTasks.filter((t) => t.kind === 'ceiling');
  const hasSchedule =
    dayTasks.length > 0 ||
    weekCommitments(state.commitments, di, wk, state.settings.repeatCommitments).some((c) => !isSleep(c));

  // Next-day rollover: when the app opens on a new day, surface yesterday's loose
  // ends. Also offer today's reward and prompt the choice (after any rollover).
  // Waits for the cloud pull to finish (`hydrated`) so two devices don't each roll
  // their own reward, and rollover reads the synced log rather than stale local data.
  const { hydrated } = useSync();
  const didInit = useRef(false);
  const [rollover, setRollover] = useState(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  useEffect(() => {
    if (!hydrated || didInit.current) return;
    didInit.current = true;
    const today = todayISO();
    const last = state.lastOpened;
    let hadRollover = false;
    if (last && last !== today) {
      const prev = addDaysISO(today, -1);
      const pdi = dayIndex(fromISO(prev));
      const plog = state.log[prev] || { tasks: {} };
      const items = weekTasks(state.tasks, pdi, weekKey(fromISO(prev)), state.settings.repeatCommitments).filter(
        (t) => !isTaskDone(t, plog.tasks?.[t.id])
      );
      if (items.length) {
        setRollover({ date: prev, items });
        hadRollover = true;
      }
    }
    if (last !== today) actions.markOpened(today);

    // Reward: offer 3 random options for today (once), then prompt to choose.
    const pool = state.rewards || [];
    const tr = state.log[today]?.reward;
    if (pool.length && !tr) actions.offerRewards(today, pickRewards(pool, 3));
    if (pool.length && !(tr && tr.chosen) && !hadRollover) setRewardOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // When the rollover modal closes, fall through to the reward chooser if needed.
  const closeRollover = () => {
    setRollover(null);
    const tr = state.log[todayISO()]?.reward;
    if ((state.rewards || []).length && !(tr && tr.chosen)) setRewardOpen(true);
  };

  return (
    <div className="space-y-4 stagger">
      <header className="flex items-center justify-between">
        <IconBtn aria-label="Previous day" onClick={() => setIso(addDaysISO(iso, -1))}>
          ‹
        </IconBtn>
        <div className="text-center">
          <div className="text-lg font-bold">{isToday ? 'Today' : prettyDate(iso)}</div>
          {isToday && <div className="text-xs text-slate-400">{prettyDate(iso)}</div>}
        </div>
        <IconBtn aria-label="Next day" onClick={() => setIso(addDaysISO(iso, 1))}>
          ›
        </IconBtn>
      </header>

      {isToday && <BedtimeCard />}

      <WeightCard iso={iso} />

      <ScoreCard score={score} />

      {isToday && <RewardCard iso={iso} floorMet={score.floorMet} />}

      {/* Golden list — the foundation, visually distinct */}
      <Card className="border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-amber-400">★</span>
          <h2 className="font-bold text-amber-200">Golden list</h2>
          <span className="text-xs text-amber-400/70">non-negotiable</span>
        </div>
        {state.golden.length === 0 ? (
          <Empty>Add non-negotiables in Setup.</Empty>
        ) : (
          <ul className="space-y-2">
            {state.golden.map((g) => {
              const on = !!dlog.golden?.[g.id];
              return (
                <li key={g.id}>
                  <button
                    onClick={() => actions.toggleGolden(iso, g.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      on
                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-100'
                        : 'border-slate-700 bg-slate-950/40 text-slate-200'
                    }`}
                  >
                    <CheckBox on={on} gold />
                    <span className="font-medium">{g.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <TaskGroup title="Mandatory tasks" subtitle="Must-do — counts toward 100%" tasks={floorTasks} iso={iso} />
      <TaskGroup title="Bonus tasks" subtitle="Nice-to-have — adds on top, up to 150%" tasks={ceilTasks} iso={iso} bonus />

      {hasSchedule && (
        <Panel collapsible persistKey="today-schedule" title={isToday ? "Today's schedule" : 'Schedule'} subtitle="What's on, in time order">
          <DayBoard di={di} weekStart={wk} />
        </Panel>
      )}

      {/* Overlays kept out of the stagger flow so they use their own animations. */}
      <div>
        {rollover && <RolloverModal rollover={rollover} onClose={closeRollover} />}
        {rewardOpen && <RewardChooserModal onClose={() => setRewardOpen(false)} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- reward */

// The chooser that pops on a new day, plus the card that tracks lock/unlock.
function RewardChooserModal({ onClose }) {
  const { state, actions } = useStore();
  const iso = todayISO();
  const pool = state.rewards || [];
  const byId = (id) => pool.find((r) => r.id === id);
  const options = (state.log[iso]?.reward?.options || []).map(byId).filter(Boolean);
  if (!options.length) return null;

  return (
    <Modal title="🎁 Choose today's reward" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-400">
        Pick one to aim for today. Hit{' '}
        <span className="font-semibold text-slate-200">100%</span> and it's yours.
      </p>
      <div className="grid gap-2">
        {options.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              actions.chooseReward(iso, r.id);
              onClose();
            }}
            className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-left text-sm font-medium text-slate-100 transition hover:border-fuchsia-400 hover:bg-fuchsia-500/10"
          >
            {r.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function RewardCard({ iso, floorMet }) {
  const { state, actions } = useStore();
  const pool = state.rewards || [];
  if (!pool.length) return null;

  const reward = state.log[iso]?.reward;
  const byId = (id) => pool.find((r) => r.id === id);
  const options = (reward?.options || []).map(byId).filter(Boolean);
  const chosen = reward?.chosen ? byId(reward.chosen) : null;

  // Not chosen yet → inline picker (in case the modal was dismissed).
  if (!chosen) {
    if (!options.length) return null;
    return (
      <Card className="border border-fuchsia-500/40 bg-fuchsia-500/5 p-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">🎁</span>
          <h2 className="font-bold text-fuchsia-200">Choose today's reward</h2>
        </div>
        <p className="mb-3 text-xs text-slate-400">Pick one — it unlocks when you hit 100%.</p>
        <div className="grid gap-2">
          {options.map((r) => (
            <button
              key={r.id}
              onClick={() => actions.chooseReward(iso, r.id)}
              className="rounded-xl border border-slate-700 bg-slate-950/40 p-3 text-left text-sm font-medium text-slate-100 transition hover:border-fuchsia-400 hover:bg-fuchsia-500/10"
            >
              {r.label}
            </button>
          ))}
        </div>
      </Card>
    );
  }

  // Chosen → locked until the floor is met, then claimable.
  const claimed = !!reward?.claimed;
  return (
    <Card className={`p-4 ${floorMet ? 'border border-fuchsia-400/60 bg-fuchsia-500/10' : 'border border-slate-800'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-400">{floorMet ? 'Reward unlocked 🎉' : "Today's reward"}</div>
          <div className="truncate text-lg font-bold text-fuchsia-200">🎁 {chosen.label}</div>
        </div>
        {claimed ? (
          <Pill className="bg-fuchsia-500/20 text-fuchsia-200">Enjoyed ✓</Pill>
        ) : floorMet ? (
          <Btn variant="primary" onClick={() => actions.claimReward(iso)}>
            Claim it
          </Btn>
        ) : (
          <span className="text-2xl">🔒</span>
        )}
      </div>
      {!floorMet && !claimed && (
        <p className="mt-1 text-xs text-slate-500">Hit 100% to unlock this.</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ weight */

function WeightCard({ iso }) {
  const { state, actions } = useStore();
  const logged = state.log[iso]?.weight;
  const has = typeof logged === 'number';
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  // Once logged, the input collapses to a quiet one-line confirmation.
  if (has && !editing) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
        <span className="text-slate-400">⚖️ Weighed in</span>
        <span className="flex items-center gap-3">
          <span className="font-bold text-slate-100">{logged}</span>
          <button
            onClick={() => {
              setVal(String(logged));
              setEditing(true);
            }}
            className="text-xs text-slate-500 underline"
          >
            change
          </button>
        </span>
      </div>
    );
  }

  const save = () => {
    if (val === '') return;
    actions.setWeight(iso, Number(val));
    setEditing(false);
    setVal('');
  };

  return (
    <Card className="p-4">
      <Label>Today's weight</Label>
      <div className="flex gap-2">
        <NumberInput
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="e.g. 75"
        />
        <Btn variant="primary" onClick={save}>
          Log
        </Btn>
        {has && (
          <Btn variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Btn>
        )}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- bedtime */

function BedtimeCard() {
  const { state } = useStore();
  const bedtime = state.settings.sleepStart || '23:00';
  const windDown = state.settings.windDownMin ?? 30;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [bh, bm] = bedtime.split(':').map(Number);
  const bed = new Date(now);
  bed.setHours(bh, bm, 0, 0);
  if (bed.getTime() <= now) bed.setDate(bed.getDate() + 1);
  const minsToBed = (bed.getTime() - now) / 60000;
  const inWindow = minsToBed <= windDown;

  const totalMin = Math.max(0, Math.round(minsToBed));
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  const toBedText = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;

  return (
    <Card className={`p-4 ${inWindow ? 'border border-indigo-400/50 bg-indigo-500/10' : 'border border-slate-800'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Bedtime {prettyClock(toMinutes(bedtime))}</div>
          <div className="text-2xl font-bold text-indigo-200">{toBedText} to bed</div>
        </div>
        <span className="text-3xl">🌙</span>
      </div>
      {inWindow && <div className="mt-1 text-sm font-medium text-indigo-300">Time to wind down 🌙</div>}
    </Card>
  );
}

/* ----------------------------------------------------------------- score card */

function ScoreCard({ score }) {
  if (!score.hasItems) {
    return (
      <Card className="p-5 text-center">
        <div className="text-slate-400">Nothing planned for this day.</div>
        <div className="mt-1 text-xs text-slate-500">Add tasks in the Planner.</div>
      </Card>
    );
  }
  const met = score.floorMet;
  return (
    <Card className={`p-5 text-center ${met ? 'border border-emerald-500/40 bg-emerald-500/5' : 'border border-slate-800'}`}>
      <div className={`text-5xl font-extrabold ${met ? 'text-emerald-400' : 'text-slate-200'}`}>{score.score}%</div>
      {met ? (
        <div className="mt-1 text-sm font-semibold text-emerald-300">
          All mandatory done ✓{score.score > 100 ? ` · +${score.score - 100}% bonus` : ''}
        </div>
      ) : (
        <div className="mt-1 text-sm text-slate-400">
          Mandatory: {score.floorDone}/{score.floorTotal} done
        </div>
      )}
      {score.ceilTotal > 0 && (
        <div className="mt-1 text-xs text-slate-500">
          Bonus {score.ceilDone}/{score.ceilTotal}
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- task group */

function TaskGroup({ title, subtitle, tasks, iso, bonus }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <div className="mb-2 px-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} iso={iso} bonus={bonus} />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({ task, iso, bonus }) {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);
  const entry = state.log[iso]?.tasks?.[task.id] || {};
  const done = isTaskDone(task, entry);
  const color = categoryColor(state.priorities, task.categoryId);

  return (
    <li
      className={`overflow-hidden rounded-xl border ${
        done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50'
      }`}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 p-3">
        {task.countable ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{task.title}</div>
              <div className="text-xs text-slate-500">
                {Number(entry.qty) || 0}/{task.target} {done ? '· done ✓' : ''}
              </div>
            </div>
            <IconBtn aria-label="Less" onClick={() => actions.setTaskQty(iso, task.id, Math.max(0, (Number(entry.qty) || 0) - 1))}>
              −
            </IconBtn>
            <span className="w-6 text-center text-lg font-bold">{Number(entry.qty) || 0}</span>
            <IconBtn aria-label="More" onClick={() => actions.setTaskQty(iso, task.id, (Number(entry.qty) || 0) + 1)}>
              +
            </IconBtn>
          </>
        ) : (
          <button onClick={() => actions.setTaskDone(iso, task.id, !done)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <CheckBox on={done} />
            <span className={`min-w-0 flex-1 font-medium ${done ? 'truncate line-through opacity-70' : ''}`}>{task.title}</span>
            {bonus && <Pill className="bg-sky-600/20 text-sky-300">bonus</Pill>}
          </button>
        )}
        <IconBtn aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)}>
          {open ? '▾' : '▸'}
        </IconBtn>
      </div>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          <div className="text-xs text-slate-400">
            Planned: {hrs(task.hours)}h{task.start ? ` · ${prettyClock(toMinutes(task.start))}` : ''}
          </div>
          <textarea
            rows={3}
            value={task.notes || ''}
            onChange={(e) => actions.updateTask(task.id, { notes: e.target.value })}
            placeholder="Notes / instructions…"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}

/* -------------------------------------------------------------------- rollover */

function RolloverModal({ rollover, onClose }) {
  const { actions } = useStore();
  const [items, setItems] = useState(rollover.items);

  const resolve = (id) =>
    setItems((list) => {
      const next = list.filter((t) => t.id !== id);
      if (!next.length) onClose();
      return next;
    });

  if (!items.length) return null;

  return (
    <Modal title="Yesterday's loose ends" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">
        Unfinished on {prettyDate(rollover.date)}. Reschedule or cut each — nothing piles up automatically.
      </p>
      <ul className="space-y-3">
        {items.map((t) => (
          <li key={t.id} className="rounded-xl bg-slate-950/50 p-3">
            <div className="text-sm font-medium">{t.title}</div>
            <div className="mt-2 flex items-center gap-2">
              <Select
                value=""
                onChange={(e) => {
                  if (e.target.value !== '') {
                    actions.updateTask(t.id, { day: Number(e.target.value) });
                    resolve(t.id);
                  }
                }}
                className="flex-1"
              >
                <option value="">Reschedule to…</option>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    Move to {d}
                  </option>
                ))}
              </Select>
              <Btn
                variant="danger"
                className="!px-3"
                onClick={() => {
                  actions.removeTaskLike(t.id);
                  resolve(t.id);
                }}
              >
                Cut
              </Btn>
            </div>
          </li>
        ))}
      </ul>
      <Btn variant="primary" className="mt-3 w-full" onClick={onClose}>
        Done
      </Btn>
    </Modal>
  );
}

/* --------------------------------------------------------------------- shared */

function CheckBox({ on, gold }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${
        on ? (gold ? 'border-amber-400 bg-amber-400 text-slate-900' : 'border-emerald-400 bg-emerald-400 text-slate-900') : 'border-slate-600'
      }`}
    >
      {on ? '✓' : ''}
    </span>
  );
}
