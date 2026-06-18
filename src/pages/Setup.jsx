import { useState } from 'react';
import { useStore, useSync } from '../store.jsx';
import { categoryColor } from '../lib/colors.js';
import SyncBadge from '../components/SyncBadge.jsx';
import {
  Panel,
  Btn,
  IconBtn,
  TextInput,
  NumberInput,
  Select,
  Label,
  Empty,
} from '../components/ui.jsx';

export default function Setup() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Setup</h1>
        <p className="text-sm text-slate-400">Set this once. It rarely changes.</p>
      </header>

      <Account />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel collapsible defaultOpen={false} persistKey="setup-priorities" title="Priorities" subtitle="Ranked — cuts come from the bottom up. Each has a colour.">
            <Priorities />
          </Panel>
          <Panel collapsible defaultOpen={false} persistKey="setup-golden" title="Golden list" subtitle="Daily non-negotiables — the floor">
            <Golden />
          </Panel>
          <Panel collapsible defaultOpen={false} persistKey="setup-buffer" title="Safety net" subtitle="Protected margin reserved each day">
            <Buffer />
          </Panel>
          <Panel collapsible defaultOpen={false} persistKey="setup-sleep" title="Sleep" subtitle="Auto-blocked on every day so free time is realistic">
            <SleepSchedule />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel collapsible defaultOpen={false} persistKey="setup-tasklib" title="Task library" subtitle="Reusable tasks you pull onto days in the Planner">
            <Templates />
          </Panel>
          <Panel collapsible defaultOpen={false} persistKey="setup-cmtlib" title="Commitment library" subtitle="Reusable fixed blocks like Meals or Work">
            <CommitmentTemplates />
          </Panel>
          <Panel collapsible defaultOpen={false} persistKey="setup-targets" title="Weekly targets" subtitle="Tracked automatically in the Review page">
            <Targets />
          </Panel>
        </div>
      </div>

      <DangerZone />
    </div>
  );
}

/* ------------------------------------------------------------------- account */

function Account() {
  const { enabled, email, status, signOut } = useSync();
  if (!enabled) return null;
  return (
    <Panel title="Account" subtitle={email ? `Signed in as ${email}` : 'Cloud sync'}>
      <div className="flex items-center justify-between gap-3">
        <SyncBadge />
        <Btn onClick={signOut}>Sign out</Btn>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Your week syncs to the cloud so it's the same on every device. Status: {status}.
      </p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- priorities */

function Priorities() {
  const { state, actions } = useStore();
  const [name, setName] = useState('');
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {state.priorities.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-950/50 p-2">
            <span className="w-5 text-center text-sm font-bold text-slate-500">{i + 1}</span>
            <span
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(state.priorities, p.id) }}
            />
            <TextInput value={p.name} onChange={(e) => actions.renamePriority(p.id, e.target.value)} />
            <IconBtn aria-label="Up" disabled={i === 0} onClick={() => actions.movePriority(p.id, -1)}>
              ↑
            </IconBtn>
            <IconBtn
              aria-label="Down"
              disabled={i === state.priorities.length - 1}
              onClick={() => actions.movePriority(p.id, 1)}
            >
              ↓
            </IconBtn>
            <IconBtn aria-label="Delete" onClick={() => actions.removePriority(p.id)}>
              ✕
            </IconBtn>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <TextInput placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <Btn
          onClick={() => {
            if (name.trim()) {
              actions.addPriority(name.trim());
              setName('');
            }
          }}
        >
          Add
        </Btn>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- golden */

function Golden() {
  const { state, actions } = useStore();
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {state.golden.map((g) => (
          <li key={g.id} className="flex items-center gap-2">
            <span className="text-amber-400">★</span>
            <TextInput value={g.label} onChange={(e) => actions.renameGolden(g.id, e.target.value)} />
            <IconBtn aria-label="Delete" onClick={() => actions.removeGolden(g.id)}>
              ✕
            </IconBtn>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <TextInput placeholder="New non-negotiable" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Btn
          onClick={() => {
            if (label.trim()) {
              actions.addGolden(label.trim());
              setLabel('');
            }
          }}
        >
          Add
        </Btn>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- buffer */

function Buffer() {
  const { state, actions } = useStore();
  const pct = Math.round(state.settings.bufferPct * 100);
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>Reserved margin per day</Label>
        <span className="text-lg font-bold text-sky-300">{pct}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="40"
        step="5"
        value={pct}
        onChange={(e) => actions.setBufferPct(Number(e.target.value) / 100)}
        className="w-full accent-sky-500"
      />
      <p className="mt-1 text-xs text-slate-500">
        Tasks can only be scheduled into the remaining {100 - pct}% of free time.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- sleep */

function SleepSchedule() {
  const { state, actions } = useStore();
  const [hours, setHours] = useState(state.settings.sleepHours);
  const [start, setStart] = useState(state.settings.sleepStart);
  const sleepCount = state.commitments.filter((c) => /sleep/i.test(c.label || '')).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Hours / night</Label>
          <NumberInput min="0" step="0.5" value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} />
        </div>
        <div>
          <Label>Bedtime</Label>
          <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
      </div>
      <Btn variant="primary" className="w-full" onClick={() => actions.applySleepToAllDays(hours, start)}>
        Apply sleep to all 7 days
      </Btn>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{sleepCount > 0 ? `${sleepCount} sleep blocks set` : 'No sleep blocks'}</span>
        {sleepCount > 0 && (
          <button
            className="text-slate-500 underline"
            onClick={() =>
              state.commitments
                .filter((c) => /sleep/i.test(c.label || ''))
                .forEach((c) => actions.removeCommitment(c.id))
            }
          >
            Remove sleep blocks
          </button>
        )}
      </div>

      <div className="border-t border-slate-800 pt-3">
        <Label>Wind-down before bed (minutes)</Label>
        <NumberInput
          min="0"
          step="5"
          value={state.settings.windDownMin ?? 30}
          onChange={(e) => actions.setWindDown(Number(e.target.value) || 0)}
        />
        <p className="mt-1 text-xs text-slate-500">
          The Today page prompts you to start winding down this long before bedtime.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- templates */

const KINDS = [
  { id: 'floor', label: 'Floor (must-do)' },
  { id: 'ceiling', label: 'Ceiling (bonus)' },
];

function Templates() {
  const { state, actions } = useStore();
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Define a task once; pull it onto any day from the Planner without re-entering the details.
      </p>

      {state.templates.length === 0 && <Empty>No saved tasks yet.</Empty>}

      {state.templates.map((t) => (
        <div key={t.id} className="space-y-2 rounded-xl bg-slate-950/50 p-3">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: categoryColor(state.priorities, t.categoryId) }}
            />
            <TextInput
              placeholder="Task name (e.g. Coursework block)"
              value={t.name}
              onChange={(e) => actions.updateTemplate(t.id, { name: e.target.value })}
            />
            <IconBtn aria-label="Delete" onClick={() => actions.removeTemplate(t.id)}>
              ✕
            </IconBtn>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Select value={t.categoryId} onChange={(e) => actions.updateTemplate(t.id, { categoryId: e.target.value })}>
                {state.priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Default hours</Label>
              <NumberInput
                min="0"
                step="0.25"
                value={t.hours}
                onChange={(e) => actions.updateTemplate(t.id, { hours: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={t.kind} onChange={(e) => actions.updateTemplate(t.id, { kind: e.target.value })}>
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Countable</Label>
              <label className="flex h-11 items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-600 bg-slate-900 accent-emerald-500"
                  checked={t.countable}
                  onChange={(e) => actions.updateTemplate(t.id, { countable: e.target.checked })}
                />
                log a number
              </label>
            </div>
            {t.countable && (
              <div>
                <Label>Target count</Label>
                <NumberInput
                  min="1"
                  value={t.target}
                  onChange={(e) => actions.updateTemplate(t.id, { target: Number(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>
          <div>
            <Label>Notes / instructions</Label>
            <textarea
              rows={2}
              value={t.notes || ''}
              onChange={(e) => actions.updateTemplate(t.id, { notes: e.target.value })}
              placeholder="Carried onto every task placed from this template…"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      ))}

      <Btn variant="primary" className="w-full" onClick={() => actions.addTemplate({})}>
        Add saved task
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------- commitment templates */

function CommitmentTemplates() {
  const { state, actions } = useStore();
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Reusable fixed blocks (e.g. Meals, Work shift, MMA). Drag them onto days in the Planner to
        protect that time — the same way sleep is auto-blocked.
      </p>

      {state.commitmentTemplates.length === 0 && <Empty>No commitment templates yet.</Empty>}

      {state.commitmentTemplates.map((t) => (
        <div key={t.id} className="space-y-2 rounded-xl bg-slate-950/50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-300">🔒</span>
            <TextInput
              placeholder="Name (e.g. Meals)"
              value={t.name}
              onChange={(e) => actions.updateCommitmentTemplate(t.id, { name: e.target.value })}
            />
            <IconBtn aria-label="Delete" onClick={() => actions.removeCommitmentTemplate(t.id)}>
              ✕
            </IconBtn>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Default hours</Label>
              <NumberInput
                min="0"
                step="0.25"
                value={t.hours}
                onChange={(e) => actions.updateCommitmentTemplate(t.id, { hours: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Default time (optional)</Label>
              <TextInput
                type="time"
                value={t.start || ''}
                onChange={(e) => actions.updateCommitmentTemplate(t.id, { start: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <Btn variant="primary" className="w-full" onClick={() => actions.addCommitmentTemplate({})}>
        Add commitment template
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------- targets */

const METRICS = [
  { id: 'hours', label: 'Hours done' },
  { id: 'sessions', label: 'Sessions done' },
  { id: 'count', label: 'Count logged' },
];

const METRIC_HINT = {
  hours: 'sums completed task hours in this category',
  sessions: 'counts completed tasks in this category',
  count: 'sums logged quantities of countable tasks',
};

function Targets() {
  const { state, actions } = useStore();
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Each target tracks progress automatically from the tasks in its category.
      </p>

      {state.targets.length === 0 && <Empty>No targets yet.</Empty>}

      {state.targets.map((t) => (
        <div key={t.id} className="space-y-2 rounded-xl bg-slate-950/50 p-3">
          <div className="flex items-center gap-2">
            <TextInput
              placeholder="Target name (e.g. Coursework hours)"
              value={t.label}
              onChange={(e) => actions.updateTarget(t.id, { label: e.target.value })}
            />
            <IconBtn aria-label="Delete target" onClick={() => actions.removeTarget(t.id)}>
              ✕
            </IconBtn>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Select value={t.categoryId} onChange={(e) => actions.updateTarget(t.id, { categoryId: e.target.value })}>
                {state.priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Measure by</Label>
              <Select value={t.metric} onChange={(e) => actions.updateTarget(t.id, { metric: e.target.value })}>
                {METRICS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Target</Label>
              <NumberInput
                min="0"
                step="0.5"
                value={t.target}
                onChange={(e) => actions.updateTarget(t.id, { target: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Stretch (optional)</Label>
              <NumberInput
                min="0"
                step="0.5"
                placeholder="—"
                value={t.ceiling ?? ''}
                onChange={(e) =>
                  actions.updateTarget(t.id, {
                    ceiling: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">{METRIC_HINT[t.metric]}</p>
        </div>
      ))}

      <Btn variant="primary" className="w-full" onClick={() => actions.addTarget({})}>
        Add target
      </Btn>
    </div>
  );
}

/* ---------------------------------------------------------------- danger zone */

function DangerZone() {
  const { actions } = useStore();
  return (
    <div className="pt-2 text-center">
      <button
        onClick={() => {
          if (confirm('Reset everything to seed data? This clears all your logs and plans.')) {
            actions.resetAll();
          }
        }}
        className="text-xs text-slate-600 underline"
      >
        Reset all data
      </button>
    </div>
  );
}
