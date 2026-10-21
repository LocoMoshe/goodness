import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useGoodness } from '@/contexts/GoodnessContext';

interface BadgeRow { id: string; name: string; description: string; image: string; required: number; done: number; achieved: boolean }

const Badges: React.FC = () => {
  const { stats } = useGoodness();
  const [badges, setBadges] = useState<BadgeRow[]>([]);

  useEffect(() => {
    supabase.rpc('get_my_badges').then(({ data }) => setBadges((data as BadgeRow[]) ?? []));
  }, [stats]);

  const earned = badges.filter((b) => b.achieved).length;

  return (
    <MainLayout title="Badges">
      <div className="px-6 flex flex-col gap-5">
        <p className="text-sun-muted">
          {earned} of {badges.length} earned. Badges count verified deeds only.
        </p>

        <Link to="/leaderboard" className="sun-card p-4 flex items-center gap-3">
          <Trophy size={22} className="text-sun-accent" />
          <span className="flex-1 font-semibold">Community leaderboard</span>
          <ArrowRight size={20} className="text-sun-muted" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          {badges.map((b) => {
            const pct = Math.round((b.done / b.required) * 100);
            return (
              <div key={b.id} className={`sun-card p-4 flex flex-col items-center text-center gap-2 ${b.achieved ? 'border-sun-accent' : ''}`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${b.achieved ? 'bg-sun-accent/15' : 'bg-sun-line grayscale opacity-60'}`}>
                  <span aria-hidden="true">{b.image}</span>
                </div>
                <p className={`font-semibold ${b.achieved ? '' : 'text-sun-muted'}`}>{b.name}</p>
                <p className="text-xs text-sun-muted">{b.description}</p>
                {!b.achieved && (
                  <div className="w-full">
                    <div className="h-1.5 rounded-full bg-sun-line overflow-hidden">
                      <div className="h-full bg-sun-accent rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-sun-muted mt-1">{b.done} / {b.required}</p>
                  </div>
                )}
                {b.achieved && <p className="text-xs font-semibold text-sun-accent">Earned</p>}
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
};

export default Badges;
