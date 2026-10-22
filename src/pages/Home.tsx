import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Smartphone, X } from 'lucide-react';
import { format } from 'date-fns';
import MainLayout from '@/components/MainLayout';
import Logo from '@/components/Logo';
import { useGoodness, type Draft } from '@/contexts/GoodnessContext';
import { supabase } from '@/integrations/supabase/client';

interface DeedRow {
  id: string;
  description: string;
  impact_level: 'Low' | 'Medium' | 'High';
  validation_status: 'Pending' | 'Verified' | 'Flagged';
  tokens_earned: number;
  created_at: string;
}

export const deedStatusLine = (d: DeedRow) => {
  if (d.impact_level === 'Low') return 'Small deed · trust & streak';
  if (d.validation_status === 'Verified') return `+${d.tokens_earned} points`;
  if (d.validation_status === 'Flagged') return 'Not confirmed';
  return `${d.tokens_earned} points pending`;
};

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const Home: React.FC = () => {
  const { stats, unread, openQuickLog, openDraft, shakeOn, shakeAvailable, enableShake } = useGoodness();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [recent, setRecent] = useState<DeedRow[]>([]);
  const [shakeMsg, setShakeMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('deeds')
      .select('id, description, impact_level, validation_status, tokens_earned, created_at')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecent((data as DeedRow[]) ?? []));
  }, [stats]);

  useEffect(() => {
    supabase
      .from('deed_drafts')
      .select('id, description, created_at')
      .order('created_at', { ascending: true })
      .then(({ data }) => setDrafts((data as Draft[]) ?? []));
  }, [stats]);

  const dropDraft = async (id: string) => {
    setDrafts((ds) => ds.filter((d) => d.id !== id));
    await supabase.from('deed_drafts').delete().eq('id', id);
  };

  const todayIndex = (new Date().getDay() + 6) % 7;

  const turnOnShake = async () => {
    const ok = await enableShake();
    setShakeMsg(ok ? 'Shake is on. Give your phone a firm shake to try it.' : 'Your phone said no. You can allow motion in Settings › Safari.');
  };

  return (
    <MainLayout>
      <div className="px-6 safe-top flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo size={36} />
          <Link
            to="/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative w-11 h-11 rounded-full bg-sun-surface border border-sun-line flex items-center justify-center"
          >
            <Bell size={20} />
            {unread > 0 && <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-sun-accent" />}
          </Link>
        </div>

        <section>
          <p className="text-sun-muted">{stats ? `Hi ${stats.name.split(' ')[0]}, your goodness this week` : 'Your goodness this week'}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[72px] leading-none font-bold text-sun-accent">{stats?.deeds_this_week ?? 0}</span>
            <span className="text-xl font-semibold">good deed{stats?.deeds_this_week === 1 ? '' : 's'}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-4" aria-label="Days you did good this week">
            {DAYS.map((d, i) => {
              const did = stats?.week?.[i];
              const isToday = i === todayIndex;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`h-9 w-full rounded-lg ${
                      did ? 'bg-sun-accent' : isToday ? 'border-2 border-sun-accent' : i < todayIndex ? 'bg-sun-line' : 'bg-sun-surface border border-sun-line'
                    }`}
                  />
                  <span className="text-xs text-sun-muted">{d}</span>
                </div>
              );
            })}
          </div>
          {stats && stats.streak > 1 && (
            <p className="text-sm text-sun-muted mt-3">{stats.streak}-day streak. Keep it going.</p>
          )}
        </section>

        <button
          onClick={openQuickLog}
          className="min-h-[64px] rounded-[20px] bg-sun-accent text-white flex items-center justify-between px-5 font-bold text-lg active:scale-[0.98] transition"
        >
          <span>{shakeOn ? 'Shake or tap to log' : 'Tap to log a deed'}</span>
          <ArrowRight size={24} strokeWidth={2.2} />
        </button>

        {drafts.length > 0 && (
          <section className="sun-card p-4 flex flex-col gap-3" aria-label="Quick notes to finish">
            <div>
              <p className="font-semibold">
                {drafts.length} quick note{drafts.length === 1 ? '' : 's'} to finish
              </p>
              <p className="text-sm text-sun-muted">Pick a size so it can be verified</p>
            </div>
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2 border-t border-sun-line pt-3">
                <button onClick={() => openDraft(d)} className="flex-1 min-w-0 text-left min-h-[44px]">
                  <p className="font-semibold truncate">{d.description}</p>
                  <p className="text-sm text-sun-muted">{format(new Date(d.created_at), 'd MMM, HH:mm')}</p>
                </button>
                <button onClick={() => openDraft(d)} className="sun-chip bg-sun-accent text-white border-sun-accent">
                  Finish
                </button>
                <button
                  onClick={() => dropDraft(d.id)}
                  aria-label={`Delete note: ${d.description}`}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sun-muted"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </section>
        )}

        {shakeAvailable && !shakeOn && (
          <div className="sun-card p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-sun-line flex items-center justify-center shrink-0">
              <Smartphone size={20} className="text-sun-accent" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Log with a shake</p>
              <p className="text-sm text-sun-muted mt-0.5">Shake your phone anywhere in the app to log a deed in seconds.</p>
              <button onClick={turnOnShake} className="mt-3 text-sun-accent font-semibold min-h-[44px]">
                Turn on shake
              </button>
              {shakeMsg && <p className="text-sm text-sun-muted">{shakeMsg}</p>}
            </div>
          </div>
        )}
        {shakeOn && shakeMsg && <p className="text-sm text-sun-teal -mt-3">{shakeMsg}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Link to="/rewards" className="sun-card p-4 flex flex-col gap-1">
            <span className="text-sm text-sun-muted">Points</span>
            <span className="text-[26px] font-bold">{stats?.points ?? 0}</span>
            {!!stats?.pending_points && <span className="text-xs text-sun-muted">+{stats.pending_points} pending</span>}
          </Link>
          <Link to="/profile" className="sun-card p-4 flex flex-col gap-1">
            <span className="text-sm text-sun-muted">Trust score</span>
            <span className="text-[26px] font-bold">{stats?.trust ?? '–'}</span>
          </Link>
        </div>

        {stats?.can_verify && stats.verify_queue_size > 0 && (
          <Link to="/verify" className="sun-card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{stats.verify_queue_size} deed{stats.verify_queue_size === 1 ? '' : 's'} need a check</p>
              <p className="text-sm text-sun-muted">Verify honestly to raise your trust score</p>
            </div>
            <ArrowRight size={20} className="text-sun-accent" />
          </Link>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-sun-muted">Latest</h2>
          {recent.length === 0 && <p className="text-sun-muted">Nothing yet. Your first deed is one shake away.</p>}
          {recent.map((d) => (
            <div key={d.id} className="flex gap-3 items-start">
              <span
                className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  d.validation_status === 'Verified'
                    ? 'bg-sun-accent'
                    : d.validation_status === 'Flagged'
                    ? 'bg-sun-danger'
                    : 'border-2 border-sun-muted'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{d.description}</p>
                <p className="text-sm text-sun-muted">
                  {deedStatusLine(d)} · {format(new Date(d.created_at), 'd MMM, HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </MainLayout>
  );
};

export default Home;
