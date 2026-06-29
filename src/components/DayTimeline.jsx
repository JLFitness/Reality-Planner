// The big visual day board. Renders commitments + tasks on a time grid.
// Interactive mode (mouse, pen AND touch): drag a block to a time (snaps to
// 30-min, no overlaps), drag it off the side to remove it, and tap a block to
// edit it. Library items can be dropped on directly (mouse via HTML5 DnD; touch
// via the pointer-based drag handled in the Planner).
import { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { dayLayout, findDropStart, occupiedRanges, wakingWindow, SNAP_MIN } from '../lib/timeline.js';
import { DAYS, clockLabel, prettyClock, hrs, minToHHMM, toMinutes, blockHours, addClock, weekKey, addDaysISO, todayISO } from '../lib/time.js';
import { tint } from '../lib/colors.js';
import { Modal, Btn, TextInput, NumberInput, Select, Label } from './ui.jsx';

export default function DayBoard({ di, interactive = false, dragHighlight = false, weekStart = weekKey(new Date()) }) {
  const { state, actions } = useStore();
  const layout = dayLayout(state, di, weekStart);
  const PPH = interactive ? 38 : 34; // pixels per hour (compact)
  const { W0, W1, span, blocks, marks } = layout;

  const gridRef = useRef(null);
  const draggedRef = useRef(false);
  const [editItem, setEditItem] = useState(null); // { type:'task'|'commitment', id }
  const [drag, setDrag] = useState(null); // { id, durMin, previewMin, valid, remove }
  const [dropMin, setDropMin] = useState(null); // preview line while dragging a library item in

  const h = (min) => (min / 60) * PPH;
  const top = (min) => h(min - W0);
  const yToMin = (clientY) => {
    const rect = gridRef.current.getBoundingClientRect();
    return ((clientY - rect.top) / PPH) * 60 + W0;
  };

  const editTask = editItem?.type === 'task' ? state.tasks.find((t) => t.id === editItem.id) : null;
  const editCommit =
    editItem?.type === 'commitment' ? state.commitments.find((c) => c.id === editItem.id) : null;
  if (editItem && !editTask && !editCommit) setEditItem(null);

  // Drag an existing task/commitment block: move to a time, or off the side to
  // remove. Works for mouse, pen and touch (blocks set touch-action:none so the
  // page doesn't scroll mid-drag; a small movement threshold keeps tap = edit).
  const startDrag = (e, b) => {
    if (!interactive) return;
    const isCommit = b.type === 'commitment';
    const id = isCommit ? b.id : b.taskId;
    let durMin;
    let anchorMin;
    if (isCommit) {
      const c = state.commitments.find((x) => x.id === id);
      if (!c) return;
      durMin = blockHours(c.start, c.end) * 60;
      anchorMin = toMinutes(c.start);
    } else {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return;
      durMin = (Number(t.hours) || 0) * 60;
      anchorMin = t.start ? toMinutes(t.start) : b.top;
    }
    e.preventDefault();
    const grab = yToMin(e.clientY) - anchorMin;
    const downX = e.clientX;
    const downY = e.clientY;
    draggedRef.current = false;

    // Remove intent: dragged off the side (easy with a mouse), or — on touch,
    // where the screen edges are awkward — dropped onto the bottom "bin" bar.
    const isTouch = e.pointerType === 'touch';
    const wantRemove = (ev) => {
      if (isTouch && ev.clientY > window.innerHeight - 88) return true;
      const rect = gridRef.current.getBoundingClientRect();
      return ev.clientX < rect.left - 6 || ev.clientX > rect.right + 6;
    };

    const move = (ev) => {
      if (Math.abs(ev.clientX - downX) > 4 || Math.abs(ev.clientY - downY) > 4) draggedRef.current = true;
      if (wantRemove(ev)) {
        setDrag({ id, durMin, remove: true, touch: isTouch });
        return;
      }
      const snapped = Math.round((yToMin(ev.clientY) - grab) / SNAP_MIN) * SNAP_MIN;
      const occ = occupiedRanges(state, di, id, weekStart);
      const clamped = Math.max(W0, Math.min(W1 - durMin, snapped));
      const fits =
        clamped >= W0 &&
        clamped + durMin <= W1 &&
        !occ.some((r) => clamped < r.end - 0.01 && clamped + durMin > r.start + 0.01);
      setDrag({ id, durMin, previewMin: clamped, valid: fits, remove: false, touch: isTouch });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (draggedRef.current) {
        if (wantRemove(ev)) {
          if (isCommit) actions.removeCommitment(id);
          else actions.removeTaskLike(id);
        } else {
          const desired = yToMin(ev.clientY) - grab;
          const slot = findDropStart(state, di, id, desired, durMin, weekStart);
          if (slot != null) {
            const startHHMM = minToHHMM(slot);
            if (isCommit) actions.updateCommitment(id, { start: startHHMM, end: addClock(startHHMM, durMin / 60) });
            else actions.updateTask(id, { start: startHHMM });
          }
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onBlockClick = (b) => {
    if (!interactive) return;
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setEditItem(b.type === 'commitment' ? { type: 'commitment', id: b.id } : { type: 'task', id: b.taskId });
  };

  // Dropping a library item (task/commitment template) onto the board at a time.
  const isLibraryDrag = (e) =>
    e.dataTransfer.types.includes('text/tasktpl') || e.dataTransfer.types.includes('text/cmttpl');

  const onDragOver = (e) => {
    if (!interactive || !isLibraryDrag(e)) return;
    e.preventDefault();
    const snapped = Math.round(yToMin(e.clientY) / SNAP_MIN) * SNAP_MIN;
    setDropMin(Math.max(W0, Math.min(W1, snapped)));
  };

  const onDrop = (e) => {
    setDropMin(null);
    if (!interactive) return;
    const taskTpl = e.dataTransfer.getData('text/tasktpl');
    const cmtTpl = e.dataTransfer.getData('text/cmttpl');
    if (!taskTpl && !cmtTpl) return;
    e.preventDefault();
    const desired = yToMin(e.clientY);
    if (taskTpl) {
      const tpl = state.templates.find((x) => x.id === taskTpl);
      const dur = (Number(tpl?.hours) || 0) * 60;
      const slot = findDropStart(state, di, null, desired, dur, weekStart);
      actions.addTaskFromTemplate(taskTpl, di, slot != null ? minToHHMM(slot) : null, weekStart);
    } else {
      const tpl = state.commitmentTemplates.find((x) => x.id === cmtTpl);
      const dur = (Number(tpl?.hours) || 0) * 60;
      const snapped = Math.round(desired / SNAP_MIN) * SNAP_MIN;
      const clamped = Math.max(W0, Math.min(Math.max(W0, W1 - dur), snapped));
      actions.addCommitmentFromTemplate(cmtTpl, di, minToHHMM(clamped), weekStart);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {/* hour labels */}
        <div className="relative w-10 shrink-0" style={{ height: h(span) }}>
          {marks.map((m) => (
            <div
              key={m}
              className="absolute right-0 -translate-y-1/2 text-[10px] text-slate-500"
              style={{ top: top(m) }}
            >
              {clockLabel(m)}
            </div>
          ))}
        </div>

        {/* track */}
        <div
          ref={gridRef}
          data-drop-day={di}
          data-drop-past={interactive ? '0' : '1'}
          onDragOver={onDragOver}
          onDragLeave={() => setDropMin(null)}
          onDrop={onDrop}
          className={`relative flex-1 overflow-hidden rounded-xl border bg-slate-950/40 ${
            dropMin != null || dragHighlight ? 'border-emerald-400' : 'border-slate-800'
          }`}
          style={{ height: h(span) }}
        >
          {marks.map((m) => (
            <div key={m} className="absolute inset-x-0 border-t border-slate-800/60" style={{ top: top(m) }} />
          ))}

          {blocks.map((b, i) => {
            const style = { top: top(b.top), height: Math.max(2, h(b.height)) };

            if (b.type === 'free') return <div key={i} className="absolute inset-x-0" style={style} />;

            if (b.type === 'buffer') {
              return (
                <div
                  key={i}
                  className="absolute inset-x-1 flex items-center justify-center rounded-md"
                  style={{
                    ...style,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(56,189,248,0.12) 0 6px, transparent 6px 12px)',
                    border: '1px dashed rgba(56,189,248,0.4)',
                  }}
                >
                  {h(b.height) > 22 && (
                    <span className="text-[10px] font-medium text-sky-300/80">Safety net · {hrs(b.height / 60)}h</span>
                  )}
                </div>
              );
            }

            if (b.type === 'commitment') {
              return (
                <div
                  key={i}
                  onPointerDown={(e) => startDrag(e, b)}
                  onClick={() => onBlockClick(b)}
                  className={`absolute inset-x-1 flex items-center gap-1 overflow-hidden rounded-md border border-slate-600/60 bg-slate-700/40 px-2 ${
                    interactive ? 'cursor-pointer select-none touch-none' : ''
                  }`}
                  style={style}
                >
                  <span className="truncate text-[11px] font-medium text-slate-200">
                    🔒 {b.label}
                    {h(b.height) > 20 && <span className="text-slate-400"> · {hrs(b.hours)}h</span>}
                  </span>
                </div>
              );
            }

            // task
            return (
              <div
                key={i}
                onPointerDown={(e) => startDrag(e, b)}
                onClick={() => onBlockClick(b)}
                className={`absolute inset-x-1 flex items-center overflow-hidden rounded-md px-2 ${
                  interactive ? 'cursor-pointer select-none touch-none' : ''
                }`}
                style={{
                  ...style,
                  backgroundColor: tint(b.color, b.overloaded ? 0.3 : 0.24),
                  borderLeft: `3px solid ${b.color}`,
                  outline: b.overloaded ? '1.5px solid #f43f5e' : 'none',
                  outlineOffset: '-1.5px',
                }}
              >
                {b.label && (
                  <span className="flex min-w-0 items-center gap-1 truncate text-[11px] font-medium text-slate-100">
                    {b.anchored && <span className="text-slate-300/70">🕒</span>}
                    {b.label}
                    {b.hours != null && h(b.height) > 18 && (
                      <span className="text-slate-300/80"> · {hrs(b.hours)}h</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}

          {/* drop indicator while dragging a library item in */}
          {dropMin != null && (
            <div
              className="pointer-events-none absolute inset-x-1 z-10 border-t-2 border-dashed border-emerald-400"
              style={{ top: top(dropMin) }}
            />
          )}

          {/* drag preview (move) */}
          {drag && !drag.remove && (
            <div
              className="pointer-events-none absolute inset-x-1 rounded-md"
              style={{
                top: top(drag.previewMin),
                height: Math.max(2, h(drag.durMin)),
                border: `2px dashed ${drag.valid ? '#34d399' : '#f43f5e'}`,
                backgroundColor: drag.valid ? 'rgba(52,211,153,0.12)' : 'rgba(244,63,94,0.12)',
              }}
            />
          )}

          {/* drag-off-to-remove banner */}
          {drag?.remove && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center bg-rose-500/25 py-2 text-xs font-semibold text-rose-100">
              🗑 Release to remove
            </div>
          )}
        </div>
      </div>

      {/* Touch: a reachable bin pinned to the bottom of the screen while dragging. */}
      {drag?.touch && (
        <div
          className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 py-5 text-sm font-semibold transition-colors ${
            drag.remove ? 'bg-rose-500 text-white' : 'bg-slate-800/95 text-slate-300'
          }`}
        >
          🗑 {drag.remove ? 'Release to remove' : 'Drag here to remove'}
        </div>
      )}

      {interactive && (
        <p className="mt-2 text-[11px] text-slate-500">
          Tap to edit · drag to set a time · drag to the bin to remove · drop a saved item here
        </p>
      )}

      {editTask && <TaskEditor task={editTask} di={di} onClose={() => setEditItem(null)} />}
      {editCommit && <CommitmentEditor commitment={editCommit} di={di} onClose={() => setEditItem(null)} />}
    </>
  );
}

/* --------------------------------------------------------------- task editor */

function TaskEditor({ task, di, onClose }) {
  const { state, actions } = useStore();
  const { W0, W1 } = wakingWindow(state, di);
  const durMin = (Number(task.hours) || 0) * 60;
  const occ = occupiedRanges(state, di, task.id, task.weekStart);
  const fits = (s, dur) =>
    s >= W0 && s + dur <= W1 && !occ.some((r) => s < r.end - 0.01 && s + dur > r.start + 0.01);

  const slots = [];
  for (let m = Math.ceil(W0 / SNAP_MIN) * SNAP_MIN; m + durMin <= W1; m += SNAP_MIN) {
    if (fits(m, durMin)) slots.push(m);
  }
  const curMin = task.start ? toMinutes(task.start) : null;

  const setHours = (val) => {
    const newDur = val * 60;
    const patch = { hours: val };
    if (task.start) {
      const s = toMinutes(task.start);
      if (!fits(s, newDur)) {
        const slot = findDropStart(state, di, task.id, s, newDur, task.weekStart);
        patch.start = slot != null ? minToHHMM(slot) : null;
      }
    }
    actions.updateTask(task.id, patch);
  };

  const setDay = (nd) => {
    const patch = { day: nd };
    if (task.start) {
      const s = toMinutes(task.start);
      const slot = findDropStart(state, nd, task.id, s, durMin, task.weekStart);
      patch.start = slot != null ? minToHHMM(slot) : null;
    }
    actions.updateTask(task.id, patch);
  };

  return (
    <Modal title="Edit task" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-200">{task.title}</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Duration (hours)</Label>
            <NumberInput
              step="0.25"
              min="0"
              value={task.hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Day</Label>
            <Select value={task.day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Time</Label>
          <Select
            value={task.start || ''}
            onChange={(e) => actions.updateTask(task.id, { start: e.target.value || null })}
          >
            <option value="">Unscheduled (auto-fit)</option>
            {curMin != null && !slots.includes(curMin) && (
              <option value={task.start}>{prettyClock(curMin)} (current)</option>
            )}
            {slots.map((m) => (
              <option key={m} value={minToHHMM(m)}>
                {prettyClock(m)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn
            variant="danger"
            onClick={() => {
              actions.removeTaskLike(task.id);
              onClose();
            }}
          >
            Delete
          </Btn>
          <Btn variant="primary" className="flex-1" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- commitment editor */

function CommitmentEditor({ commitment, di, onClose }) {
  const { actions } = useStore();
  const wk = commitment.weekStart || weekKey(new Date());
  const durHrs = blockHours(commitment.start, commitment.end);

  const setStart = (hhmm) => {
    if (!hhmm) return;
    actions.updateCommitment(commitment.id, { start: hhmm, end: addClock(hhmm, durHrs) });
  };
  const setHours = (val) => {
    actions.updateCommitment(commitment.id, { end: addClock(commitment.start, val) });
  };

  return (
    <Modal title="Edit commitment" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-200">🔒 {commitment.label}</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Start time</Label>
            <TextInput type="time" value={commitment.start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>Duration (hours)</Label>
            <NumberInput
              step="0.25"
              min="0"
              value={Math.round(durHrs * 100) / 100}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <Label>Day</Label>
          <Select
            value={commitment.day}
            onChange={(e) => actions.updateCommitment(commitment.id, { day: Number(e.target.value) })}
          >
            {DAYS.map((d, i) => (addDaysISO(wk, i) < todayISO() ? null : (
              <option key={d} value={i}>
                {d}
              </option>
            )))}
          </Select>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn
            variant="danger"
            onClick={() => {
              actions.removeCommitment(commitment.id);
              onClose();
            }}
          >
            Delete
          </Btn>
          <Btn variant="primary" className="flex-1" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
