// Seed data and id helper. Everything here is editable in-app afterwards.
import { PALETTE } from './colors.js';
import { addClock } from './time.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

// Seven daily sleep blocks so free time reflects real waking hours from the start.
export function makeSleepBlocks(start, hours) {
  const end = addClock(start, hours);
  return Array.from({ length: 7 }, (_, day) => ({
    id: uid(),
    label: 'Sleep',
    day,
    start,
    end,
  }));
}

export function makeDefaults() {
  const priorities = ['Sleep', 'Eating', 'Fluids', 'Coursework', 'Gym', 'Content'].map(
    (name, i) => ({ id: uid(), name, color: PALETTE[i % PALETTE.length] })
  );

  const golden = ['Hit sleep target', 'Eat all planned meals', 'Hit water target'].map((label) => ({
    id: uid(),
    label,
  }));

  const catId = (name) => priorities.find((p) => p.name === name).id;

  return {
    version: 2,
    // Last local change (epoch ms) — drives last-write-wins cloud sync.
    updatedAt: 0,
    // bufferPct: protected daily margin. sleep*: drives the auto-seeded sleep blocks.
    // windDownMin: how long before bedtime the wind-down prompt kicks in.
    settings: { bufferPct: 0.2, sleepHours: 8, sleepStart: '23:00', windDownMin: 30 },
    // Ranked categories — order IS the priority. Cuts come from the bottom up.
    priorities,
    // Daily non-negotiables. All done = 100% (the floor).
    golden,
    // Immovable blocks: { id, label, day (0=Mon..6=Sun), start 'HH:MM', end 'HH:MM' }
    commitments: makeSleepBlocks('23:00', 8),
    // Weekly tasks: { id, title, hours, categoryId, kind:'floor'|'ceiling', day, countable, target }
    tasks: [],
    // Reusable task templates pulled onto days from the Planner.
    // { id, name, categoryId, hours, kind, countable, target, notes }
    templates: [
      { id: uid(), name: 'Coursework block', categoryId: catId('Coursework'), hours: 2, kind: 'floor', countable: false, target: 1, notes: '' },
      { id: uid(), name: 'Film a short', categoryId: catId('Content'), hours: 1.5, kind: 'ceiling', countable: true, target: 1, notes: '' },
      { id: uid(), name: 'Gym session', categoryId: catId('Gym'), hours: 1.5, kind: 'floor', countable: false, target: 1, notes: '' },
    ],
    // Reusable commitment templates pulled onto days from the Planner.
    // { id, name, hours (default duration), start (optional default time) }
    commitmentTemplates: [
      { id: uid(), name: 'Work shift', hours: 8, start: '09:00' },
      { id: uid(), name: 'Meals', hours: 1, start: '12:30' },
      { id: uid(), name: 'MMA', hours: 1.5, start: '18:00' },
    ],
    // Weekly targets shown in the Review page. Each auto-tracks "done" from tasks
    // via { categoryId, metric }: 'hours' | 'sessions' | 'count'. ceiling optional.
    targets: [
      { id: uid(), label: 'Coursework hours', categoryId: catId('Coursework'), metric: 'hours', target: 8, ceiling: null },
      { id: uid(), label: 'Shorts', categoryId: catId('Content'), metric: 'count', target: 2, ceiling: 3 },
      { id: uid(), label: 'Gym sessions', categoryId: catId('Gym'), metric: 'sessions', target: 3, ceiling: null },
    ],
    // Per-day logs: { [isoDate]: { golden: {id:bool}, tasks: {id:{done,qty}} } }
    log: {},
    // Per-week reflection notes: { [weekKey]: note }
    reviews: {},
    // ISO date the app was last opened — drives the next-day rollover prompt.
    lastOpened: null,
  };
}
