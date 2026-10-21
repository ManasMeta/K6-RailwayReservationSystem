import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingFlow } from './features/reservations/components/BookingFlow';
import { MyJourneys } from './features/reservations/components/MyJourneys';
import { Compass, Sparkles, Ticket, Train } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BOOK' | 'JOURNEYS'>('BOOK');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 via-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-white">
                <Train className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-orange-400 via-white to-indigo-300 bg-clip-text text-transparent">
                  YATRIO
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  NRRMS G4
                </span>
              </div>
              <p className="text-[10px] text-slate-400 -mt-0.5">National Railway Reservation & Management</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('BOOK')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'BOOK'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Book Ticket</span>
            </button>
            <button
              onClick={() => setActiveTab('JOURNEYS')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'JOURNEYS'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>My Journeys</span>
            </button>
          </nav>

          {/* User profile / session pill */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white text-[11px]">
              AS
            </div>
            <div>
              <p className="font-semibold text-slate-200 leading-none">Aarav Sharma</p>
              <span className="text-[10px] text-emerald-400 font-mono">User #1 · Passenger</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Module Sub-Header Banner */}
        <div className="mb-6 flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/30 via-slate-900/40 to-slate-950 border border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              <strong className="text-slate-200">Group 4 Engine:</strong> 10-Min Atomic Berth Holds · Advisory Locks · RAC/WL Cascade · Exclusion Constraint Enforced
            </span>
          </div>
          <span className="hidden md:inline font-mono text-[11px] text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/20">
            PostgreSQL 16 Engine Active
          </span>
        </div>

        {activeTab === 'BOOK' ? (
          <BookingFlow onBookingSuccess={() => setActiveTab('JOURNEYS')} />
        ) : (
          <MyJourneys onNewBookingClick={() => setActiveTab('BOOK')} />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-slate-950">
        <p>Yatrio National Railway Reservation and Management System (NRRMS) · Monorepo Group 4</p>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
