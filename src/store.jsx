// Single source of truth: whole app state, cached in localStorage and (optionally)
// synced to Supabase so the same data is available on every device.
//
// - localStorage is always the instant local cache (works offline).
// - When Supabase is configured AND signed in, the state blob is pulled on load /
//   focus / reconnect and pushed (debounced) on every change. Last-write-wins by an
//   `updatedAt` timestamp inside the blob — fine for a single user.
// - When Supabase isn't configured, everything runs exactly as before, local-only.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { makeDefaults, makeSleepBlocks, uid } from './lib/defaults.js';
import { colorForIndex } from './lib/colors.js';
import { addClock } from './lib/time.js';
import { supabase, supabaseEnabled, TABLE } from './lib/supabase.js';

const KEY = 'reality-planner-state-v1';
const StoreCtx = createContext(null);
const SyncCtx = createContext(null);

const hasSleep = (commitments) => commitments.some((c) => /sleep/i.test(c.label || ''));

// Merge a raw saved/remote state object over the current defaults so newly added
// fields always exist, and migrate older saves forward without losing data.
function normalize(s) {
  const d = makeDefaults();
  const settings = { ...d.settings, ...(s.settings || {}) };
  const savedCommitments = s.commitments || [];
  return {
    ...d,
    ...s,
    version: 2,
    updatedAt: Number(s.updatedAt) || 0,
    settings,
    priorities: (s.priorities || d.priorities).map((p, i) => ({
      ...p,
      color: p.color || colorForIndex(i),
    })),
    golden: s.golden || d.golden,
    commitments:
      (s.version || 1) < 2 && !hasSleep(savedCommitments)
        ? [...makeSleepBlocks(settings.sleepStart, settings.sleepHours), ...savedCommitments]
        : savedCommitments,
    tasks: s.tasks || [],
    templates: Array.isArray(s.templates) ? s.templates : d.templates,
    commitmentTemplates: Array.isArray(s.commitmentTemplates)
      ? s.commitmentTemplates
      : d.commitmentTemplates,
    targets: Array.isArray(s.targets) ? s.targets : d.targets,
    log: s.log || {},
    reviews: s.reviews || {},
    lastOpened: s.lastOpened ?? null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefaults();
    return normalize(JSON.parse(raw));
  } catch {
    return makeDefaults();
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);

  // --- sync / auth state ---
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [status, setStatus] = useState(supabaseEnabled ? 'syncing' : 'local');

  const stateRef = useRef(state);
  const sessionRef = useRef(null);
  const readyRef = useRef(false); // true once the initial pull resolves
  const suppressPush = useRef(false); // skip pushing a state we just pulled
  const pushTimer = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Every local change bumps updatedAt; the cloud uses it for last-write-wins.
  const mutate = (updater) => setState((s) => ({ ...updater(s), updatedAt: Date.now() }));

  // Always cache locally; push to the cloud after the initial pull (debounced).
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full / disabled */
    }
    if (!supabaseEnabled || !sessionRef.current) return;
    if (suppressPush.current) {
      suppressPush.current = false;
      return;
    }
    if (!readyRef.current) return;
    clearTimeout(pushTimer.current);
    setStatus('syncing');
    pushTimer.current = setTimeout(() => doPush(stateRef.current), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Track the auth session.
  useEffect(() => {
    if (!supabaseEnabled) return undefined;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Pull on sign-in, and again on focus / reconnect.
  useEffect(() => {
    if (!supabaseEnabled || !session) return undefined;
    readyRef.current = false;
    pull();
    const onFocus = () => pull();
    const onOnline = () => pull();
    const onOffline = () => setStatus('offline');
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function pull() {
    const sess = sessionRef.current;
    if (!sess) return;
    setStatus('syncing');
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('data')
        .eq('user_id', sess.user.id)
        .maybeSingle();
      if (error) throw error;
      const remote = data?.data;
      const local = stateRef.current;
      if (remote && Number(remote.updatedAt || 0) > Number(local.updatedAt || 0)) {
        suppressPush.current = true;
        setState(normalize(remote));
        readyRef.current = true;
        setStatus('synced');
      } else {
        readyRef.current = true;
        await doPush(local); // local is newer or there's no remote row yet
      }
    } catch {
      readyRef.current = true;
      setStatus(navigator.onLine ? 'error' : 'offline');
    }
  }

  async function doPush(snapshot) {
    const sess = sessionRef.current;
    if (!sess) return;
    setStatus('syncing');
    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert(
          { user_id: sess.user.id, data: snapshot, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) throw error;
      setStatus('synced');
    } catch {
      setStatus(navigator.onLine ? 'error' : 'offline');
    }
  }

  const actions = {
    // --- Priorities ---
    addPriority: (name) =>
      mutate((s) => ({
        ...s,
        priorities: [...s.priorities, { id: uid(), name, color: colorForIndex(s.priorities.length) }],
      })),
    renamePriority: (id, name) =>
      mutate((s) => ({
        ...s,
        priorities: s.priorities.map((p) => (p.id === id ? { ...p, name } : p)),
      })),
    removePriority: (id) =>
      mutate((s) => ({ ...s, priorities: s.priorities.filter((p) => p.id !== id) })),
    movePriority: (id, dir) =>
      mutate((s) => {
        const i = s.priorities.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.priorities.length) return s;
        const arr = [...s.priorities];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { ...s, priorities: arr };
      }),

    // --- Golden list ---
    addGolden: (label) => mutate((s) => ({ ...s, golden: [...s.golden, { id: uid(), label }] })),
    renameGolden: (id, label) =>
      mutate((s) => ({
        ...s,
        golden: s.golden.map((g) => (g.id === id ? { ...g, label } : g)),
      })),
    removeGolden: (id) => mutate((s) => ({ ...s, golden: s.golden.filter((g) => g.id !== id) })),

    // --- Commitments ---
    addCommitment: (c) =>
      mutate((s) => ({ ...s, commitments: [...s.commitments, { id: uid(), ...c }] })),
    updateCommitment: (id, patch) =>
      mutate((s) => ({
        ...s,
        commitments: s.commitments.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),
    removeCommitment: (id) =>
      mutate((s) => ({ ...s, commitments: s.commitments.filter((c) => c.id !== id) })),

    // --- Tasks ---
    addTask: (t) => mutate((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), ...t }] })),
    updateTask: (id, patch) =>
      mutate((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    removeTask: (id) => mutate((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),

    // --- Settings ---
    setBufferPct: (pct) => mutate((s) => ({ ...s, settings: { ...s.settings, bufferPct: pct } })),
    setWindDown: (min) => mutate((s) => ({ ...s, settings: { ...s.settings, windDownMin: min } })),
    applySleepToAllDays: (hours, start) =>
      mutate((s) => ({
        ...s,
        settings: { ...s.settings, sleepHours: hours, sleepStart: start },
        commitments: [
          ...s.commitments.filter((c) => !/sleep/i.test(c.label || '')),
          ...makeSleepBlocks(start, hours),
        ],
      })),
    markOpened: (iso) => mutate((s) => ({ ...s, lastOpened: iso })),

    // --- Commitment templates ---
    addCommitmentTemplate: (t) =>
      mutate((s) => ({
        ...s,
        commitmentTemplates: [
          ...s.commitmentTemplates,
          { id: uid(), name: '', hours: 1, start: '', ...t },
        ],
      })),
    updateCommitmentTemplate: (id, patch) =>
      mutate((s) => ({
        ...s,
        commitmentTemplates: s.commitmentTemplates.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      })),
    removeCommitmentTemplate: (id) =>
      mutate((s) => ({
        ...s,
        commitmentTemplates: s.commitmentTemplates.filter((t) => t.id !== id),
      })),
    addCommitmentFromTemplate: (templateId, day, startOverride = null) =>
      mutate((s) => {
        const t = s.commitmentTemplates.find((x) => x.id === templateId);
        if (!t) return s;
        const start = startOverride || t.start || '09:00';
        const end = addClock(start, Number(t.hours) || 1);
        return {
          ...s,
          commitments: [...s.commitments, { id: uid(), label: t.name || 'Commitment', day, start, end }],
        };
      }),

    // --- Task library (reusable templates) ---
    addTemplate: (t) =>
      mutate((s) => ({
        ...s,
        templates: [
          ...s.templates,
          {
            id: uid(),
            name: '',
            categoryId: s.priorities[0]?.id,
            hours: 1,
            kind: 'floor',
            countable: false,
            target: 1,
            notes: '',
            ...t,
          },
        ],
      })),
    updateTemplate: (id, patch) =>
      mutate((s) => ({
        ...s,
        templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    removeTemplate: (id) =>
      mutate((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) })),
    addTaskFromTemplate: (templateId, day, start = null) =>
      mutate((s) => {
        const t = s.templates.find((x) => x.id === templateId);
        if (!t) return s;
        const task = {
          id: uid(),
          title: t.name || 'Task',
          hours: Number(t.hours) || 0,
          categoryId: t.categoryId,
          kind: t.kind || 'floor',
          countable: !!t.countable,
          target: t.countable ? Number(t.target) || 1 : undefined,
          notes: t.notes || '',
          start: start || null,
          day,
        };
        return { ...s, tasks: [...s.tasks, task] };
      }),

    // --- Weekly targets ---
    addTarget: (t) =>
      mutate((s) => ({
        ...s,
        targets: [
          ...s.targets,
          { id: uid(), label: '', categoryId: s.priorities[0]?.id, metric: 'hours', target: 1, ceiling: null, ...t },
        ],
      })),
    updateTarget: (id, patch) =>
      mutate((s) => ({
        ...s,
        targets: s.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    removeTarget: (id) =>
      mutate((s) => ({ ...s, targets: s.targets.filter((t) => t.id !== id) })),

    // --- Daily logging ---
    toggleGolden: (iso, gid) =>
      mutate((s) => {
        const dl = s.log[iso] || { golden: {}, tasks: {} };
        return {
          ...s,
          log: { ...s.log, [iso]: { ...dl, golden: { ...dl.golden, [gid]: !dl.golden?.[gid] } } },
        };
      }),
    setTaskDone: (iso, tid, done) =>
      mutate((s) => {
        const dl = s.log[iso] || { golden: {}, tasks: {} };
        const prev = dl.tasks?.[tid] || {};
        return {
          ...s,
          log: { ...s.log, [iso]: { ...dl, tasks: { ...dl.tasks, [tid]: { ...prev, done } } } },
        };
      }),
    setTaskQty: (iso, tid, qty) =>
      mutate((s) => {
        const dl = s.log[iso] || { golden: {}, tasks: {} };
        const prev = dl.tasks?.[tid] || {};
        return {
          ...s,
          log: { ...s.log, [iso]: { ...dl, tasks: { ...dl.tasks, [tid]: { ...prev, qty } } } },
        };
      }),
    setWeight: (iso, weight) =>
      mutate((s) => {
        const dl = s.log[iso] || { golden: {}, tasks: {} };
        return { ...s, log: { ...s.log, [iso]: { ...dl, weight } } };
      }),

    // --- Review notes ---
    setReviewNote: (wk, note) => mutate((s) => ({ ...s, reviews: { ...s.reviews, [wk]: note } })),

    // --- Danger zone ---
    resetAll: () => mutate(() => makeDefaults()),
  };

  const guard = (fn) => (...args) =>
    supabase ? fn(...args) : Promise.resolve({ error: { message: 'Sync is not configured.' } });

  const sync = {
    enabled: supabaseEnabled,
    ready: authReady,
    session,
    status,
    email: session?.user?.email || null,
    signIn: guard((email, password) => supabase.auth.signInWithPassword({ email, password })),
    signUp: guard((email, password) => supabase.auth.signUp({ email, password })),
    signOut: guard(() => supabase.auth.signOut()),
  };

  return (
    <StoreCtx.Provider value={{ state, actions }}>
      <SyncCtx.Provider value={sync}>{children}</SyncCtx.Provider>
    </StoreCtx.Provider>
  );
}

export const useStore = () => useContext(StoreCtx);
export const useSync = () => useContext(SyncCtx);
