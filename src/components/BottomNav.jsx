// Top bar on desktop, thumb-friendly bottom bar on mobile.
import { useSync } from '../store.jsx';
import SyncBadge from './SyncBadge.jsx';

const ITEMS = [
  { id: 'planner', label: 'Planner', icon: '🗓' },
  { id: 'today', label: 'Today', icon: '✓' },
  { id: 'review', label: 'Review', icon: '📊' },
  { id: 'setup', label: 'Setup', icon: '⚙️' },
];

export default function Nav({ page, setPage }) {
  const { enabled, session, signOut } = useSync();
  return (
    <>
      {/* Desktop: sticky top nav */}
      <nav className="sticky top-0 z-20 hidden border-b border-slate-800 bg-slate-950/80 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <span className="font-bold">Reality Planner</span>
          </div>
          <div className="flex items-center gap-1">
            {ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => setPage(it.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  page === it.id
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                {it.label}
              </button>
            ))}
            <SyncBadge className="ml-2" />
            {enabled && session && (
              <button
                onClick={signOut}
                className="ml-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile: fixed bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-900/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {ITEMS.map((it) => (
            <button
              key={it.id}
              onClick={() => setPage(it.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                page === it.id ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
