// Top bar on desktop, thumb-friendly bottom bar on mobile.
import { useSync } from '../store.jsx';
import SyncBadge from './SyncBadge.jsx';

const ITEMS = [
  { id: 'planner', label: 'Planner' },
  { id: 'today', label: 'Today' },
  { id: 'review', label: 'Review' },
  { id: 'setup', label: 'Setup' },
];

// Clean line icons that inherit the active/inactive text colour via currentColor.
function NavIcon({ id, className }) {
  const p = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
  };
  switch (id) {
    case 'planner':
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
        </svg>
      );
    case 'today':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
      );
    case 'review':
      return (
        <svg {...p}>
          <path d="M3 3v18h18" />
          <path d="M7 16v-4M12 16V9M17 16v-6" />
        </svg>
      );
    case 'setup':
      return (
        <svg {...p}>
          <line x1="4" y1="8" x2="20" y2="8" />
          <line x1="4" y1="16" x2="20" y2="16" />
          <circle cx="9" cy="8" r="2.3" />
          <circle cx="15" cy="16" r="2.3" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Nav({ page, setPage }) {
  const { enabled, session, signOut } = useSync();
  return (
    <>
      {/* Desktop: sticky top nav */}
      <nav className="sticky top-0 z-20 hidden border-b border-slate-800 bg-slate-950/80 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="" className="h-7 w-7" />
            <span className="font-bold">Reality Planner</span>
          </div>
          <div className="flex items-center gap-1">
            {ITEMS.map((it) => (
              <button
                key={it.id}
                onClick={() => setPage(it.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  page === it.id
                    ? 'bg-slate-800 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <NavIcon id={it.id} className="h-4 w-4" />
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
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${
                page === it.id ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <NavIcon id={it.id} className="h-6 w-6" />
              {it.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
