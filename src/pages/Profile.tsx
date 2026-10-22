import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { LogOut, Share2, Shield } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { useGoodness } from '@/contexts/GoodnessContext';
import { supabase, errorMessage } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { deedStatusLine } from './Home';

interface DeedRow {
  id: string;
  description: string;
  impact_level: 'Low' | 'Medium' | 'High';
  validation_status: 'Pending' | 'Verified' | 'Flagged';
  tokens_earned: number;
  created_at: string;
  witness_token: string;
  witness_confirmed_at: string | null;
}

const Profile: React.FC = () => {
  const { stats, refresh, signOut, shakeOn, shakeAvailable, enableShake, disableShake, session } = useGoodness();
  const [deeds, setDeeds] = useState<DeedRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('deeds')
      .select('id, description, impact_level, validation_status, tokens_earned, created_at, witness_token, witness_confirmed_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setDeeds((data as DeedRow[]) ?? []));
  }, [stats]);

  useEffect(() => {
    if (stats) {
      setName(stats.name);
      setBio(stats.bio ?? '');
    }
  }, [stats]);

  const updateProfile = async (fields: Record<string, unknown>) => {
    if (!session) return;
    const { error } = await supabase.from('profiles').update(fields).eq('id', session.user.id);
    if (error) setMsg(errorMessage(error));
    else refresh();
  };

  const saveProfile = async () => {
    if (name.trim().length < 1) return;
    await updateProfile({ name: name.trim(), bio: bio.trim() || null });
    setEditing(false);
  };

  const askConfirm = async (d: DeedRow) => {
    const link = `${window.location.origin}/confirm/${d.witness_token}`;
    const text = `Hey! I logged helping you on Goodness Tribe. Could you tap this to confirm it happened? ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Confirm my good deed', text, url: link });
        return;
      } catch {
        /* fall back to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg('Link copied. Send it to the person you helped.');
    } catch {
      setMsg(link);
    }
  };

  const trust = stats?.trust ?? 0;
  const circ = 2 * Math.PI * 34;

  return (
    <MainLayout title="Profile">
      <div className="px-6 flex flex-col gap-5">
        <section className="sun-card p-5 flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0" aria-label={`Trust score ${trust} out of 100`} role="img">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#F0E4D8" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="#C2461F" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - trust / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{trust}</span>
              <span className="text-[10px] text-sun-muted">trust</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="pname" className="sr-only">Name</label>
                <input id="pname" className="sun-input min-h-[44px] text-base" value={name} onChange={(e) => setName(e.target.value)} />
                <label htmlFor="pbio" className="sr-only">Bio</label>
                <input id="pbio" className="sun-input min-h-[44px] text-base" value={bio} placeholder="A line about you" onChange={(e) => setBio(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveProfile} className="text-sun-accent font-semibold min-h-[44px]">Save</button>
                  <button onClick={() => setEditing(false)} className="text-sun-muted min-h-[44px] px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xl font-bold truncate">{stats?.name}</p>
                {stats?.bio && <p className="text-sm text-sun-muted">{stats.bio}</p>}
                <button onClick={() => setEditing(true)} className="text-sun-accent text-sm font-semibold min-h-[36px]">Edit profile</button>
              </>
            )}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <div className="sun-card p-3"><p className="text-xs text-sun-muted">Verified</p><p className="text-xl font-bold">{stats?.total_deeds ?? 0}</p></div>
          <div className="sun-card p-3"><p className="text-xs text-sun-muted">Streak</p><p className="text-xl font-bold">{stats?.streak ?? 0}d</p></div>
          <div className="sun-card p-3"><p className="text-xs text-sun-muted">Points</p><p className="text-xl font-bold">{stats?.points ?? 0}</p></div>
        </div>

        {msg && <p className="text-sm text-sun-teal break-all" role="status">{msg}</p>}

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-sun-muted">My deeds</h2>
          <div className="sun-card divide-y divide-sun-line">
            {deeds.length === 0 && <p className="p-4 text-sun-muted">No deeds yet.</p>}
            {deeds.map((d) => (
              <div key={d.id} className="p-4 flex flex-col gap-1">
                <p className="font-semibold">{d.description}</p>
                <p className="text-sm text-sun-muted">
                  {deedStatusLine(d)} · {format(new Date(d.created_at), 'd MMM')}
                  {d.witness_confirmed_at && <span className="text-sun-teal"> · confirmed by the person helped</span>}
                </p>
                {d.validation_status === 'Pending' && !d.witness_confirmed_at && (
                  <button onClick={() => askConfirm(d)} className="self-start text-sun-accent text-sm font-semibold min-h-[40px] flex items-center gap-1.5">
                    <Share2 size={14} /> Ask the person you helped to confirm
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="sun-card divide-y divide-sun-line">
          {shakeAvailable && (
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Shake to log</p>
                <p className="text-sm text-sun-muted">Shake your phone to open quick log</p>
              </div>
              <Switch checked={shakeOn} onCheckedChange={(on) => (on ? enableShake() : disableShake())} aria-label="Shake to log" />
            </div>
          )}
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Show me on the leaderboard</p>
              <p className="text-sm text-sun-muted">Others see your first name and verified deed count</p>
            </div>
            <Switch checked={!!stats?.is_public} onCheckedChange={(on) => updateProfile({ is_public: on })} aria-label="Show me on the leaderboard" />
          </div>
        </section>

        <details className="sun-card p-4 text-sm text-sun-muted">
          <summary className="font-semibold text-sun-text cursor-pointer min-h-[32px] flex items-center gap-2"><Shield size={16} className="text-sun-accent" /> How trust works</summary>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
            <li>Everyone starts at 60.</li>
            <li>Verified medium deed +3, big deed +5. First small deed of the day +1.</li>
            <li>A deed the community rejects: −10.</li>
            <li>Verifying in line with the others: +2. Against the others: −3.</li>
            <li>Below 50 you can't verify. At 85+ your votes count extra.</li>
          </ul>
        </details>

        <button onClick={signOut} className="sun-button-ghost w-full text-sun-danger">
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </MainLayout>
  );
};

export default Profile;
