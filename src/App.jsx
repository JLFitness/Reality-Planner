import { useState } from 'react';
import { StoreProvider, useSync } from './store.jsx';
import Nav from './components/BottomNav.jsx';
import SyncBadge from './components/SyncBadge.jsx';
import Login from './components/Login.jsx';
import Planner from './pages/Planner.jsx';
import Today from './pages/Today.jsx';
import Review from './pages/Review.jsx';
import Setup from './pages/Setup.jsx';

function Shell() {
  const { enabled, ready, session } = useSync();
  const [page, setPage] = useState('today');

  // While checking the saved session, avoid flashing the login screen.
  if (enabled && !ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  }
  if (enabled && !session) return <Login />;

  return (
    <>
      <Nav page={page} setPage={setPage} />
      {/* Mobile sync indicator (desktop shows it in the top nav) */}
      <SyncBadge className="fixed right-3 top-3 z-30 shadow-lg md:hidden" />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:pb-12 md:pt-8">
        {page === 'planner' && <Planner />}
        {page === 'today' && (
          <div className="mx-auto max-w-2xl">
            <Today />
          </div>
        )}
        {page === 'review' && (
          <div className="mx-auto max-w-2xl">
            <Review />
          </div>
        )}
        {page === 'setup' && <Setup />}
      </main>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
