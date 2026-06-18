// Small "synced / syncing / offline" indicator. Renders nothing when cloud sync
// isn't configured (the app is simply local-only then).
import { useSync } from '../store.jsx';

const MAP = {
  syncing: { dot: 'bg-amber-400 animate-pulse', label: 'Syncing…' },
  synced: { dot: 'bg-emerald-400', label: 'Synced' },
  offline: { dot: 'bg-slate-400', label: 'Offline' },
  error: { dot: 'bg-rose-400', label: 'Sync error' },
  local: { dot: 'bg-slate-500', label: 'Local only' },
};

export default function SyncBadge({ className = '' }) {
  const { enabled, status } = useSync();
  if (!enabled) return null;
  const s = MAP[status] || MAP.synced;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 ${className}`}
      title={`Cloud sync: ${s.label}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
