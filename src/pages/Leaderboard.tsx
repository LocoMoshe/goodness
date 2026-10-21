import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { supabase } from '@/integrations/supabase/client';

interface Row { rank: number; name: string; avatar: string | null; deeds: number; is_me: boolean }
type Period = 'week' | 'month' | 'all';

const Leaderboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('week');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.rpc('get_leaderboard', { p_period: period }).then(({ data }) => {
      setRows((data as Row[]) ?? []);
      setLoading(false);
    });
  }, [period]);

  return (
    <MainLayout title="Leaderboard" showBack>
      <div className="px-6 flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-1 p-1 bg-sun-surface rounded-2xl border border-sun-line" role="tablist">
          {(['week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`min-h-[44px] rounded-xl font-semibold text-sm ${period === p ? 'bg-sun-accent text-white' : 'text-sun-muted'}`}
            >
              {p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'All time'}
            </button>
          ))}
        </div>
        <p className="text-sm text-sun-muted">Verified deeds only. Private profiles are hidden.</p>
        <div className="sun-card divide-y divide-sun-line">
          {loading && <p className="p-4 text-sun-muted">Loading…</p>}
          {!loading && rows.length === 0 && <p className="p-4 text-sun-muted">No verified deeds in this period yet.</p>}
          {rows.map((r) => (
            <div key={`${r.rank}-${r.name}`} className={`p-4 flex items-center gap-3 ${r.is_me ? 'bg-sun-accent/10' : ''}`}>
              <span className={`w-7 text-center font-bold ${r.rank <= 3 ? 'text-sun-accent' : 'text-sun-muted'}`}>{r.rank}</span>
              <div className="w-10 h-10 rounded-full bg-sun-line flex items-center justify-center font-bold overflow-hidden">
                {r.avatar ? <img src={r.avatar} alt="" className="w-full h-full object-cover" /> : r.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 font-semibold truncate">
                {r.name}
                {r.is_me && <span className="text-sun-accent text-sm font-normal"> (you)</span>}
              </span>
              <span className="font-bold">{r.deeds}</span>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Leaderboard;
