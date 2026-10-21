import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ThumbsUp, ThumbsDown, UserCheck, Camera } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import MainLayout from '@/components/MainLayout';
import { useGoodness, categoryLabel, Category, Impact } from '@/contexts/GoodnessContext';
import { supabase, errorMessage } from '@/integrations/supabase/client';

interface QueueItem {
  deed_id: string;
  description: string;
  category: Category;
  impact: Impact;
  image_url: string | null;
  witness_confirmed: boolean;
  created_at: string;
}

const Verify: React.FC = () => {
  const { stats, refresh } = useGoodness();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc('get_verify_queue', { p_limit: 10 });
    setQueue((data as QueueItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (isValid: boolean) => {
    const item = queue[0];
    if (!item) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('cast_vote', { p_deed: item.deed_id, p_is_valid: isValid });
    setBusy(false);
    if (error) {
      setMsg(errorMessage(error));
    } else {
      setMsg(isValid ? 'Thanks. Counted as real.' : 'Thanks. Counted as doubtful.');
    }
    setQueue((q) => q.slice(1));
    refresh();
    if (queue.length <= 1) load();
  };

  const item = queue[0];
  const accuracy = stats && stats.votes_settled > 0 ? Math.round((stats.votes_agreed / stats.votes_settled) * 100) : null;

  return (
    <MainLayout title="Verify">
      <div className="px-6 flex flex-col gap-5">
        <p className="text-sun-muted">
          Check other people's deeds anonymously. Be honest: you gain trust when you agree with the other verifiers, and lose some when you don't.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="sun-card p-3">
            <p className="text-xs text-sun-muted">Trust</p>
            <p className="text-xl font-bold">{stats?.trust ?? '–'}</p>
          </div>
          <div className="sun-card p-3">
            <p className="text-xs text-sun-muted">Checked</p>
            <p className="text-xl font-bold">{stats?.votes_cast ?? 0}</p>
          </div>
          <div className="sun-card p-3">
            <p className="text-xs text-sun-muted">Accuracy</p>
            <p className="text-xl font-bold">{accuracy === null ? '–' : `${accuracy}%`}</p>
          </div>
        </div>

        {msg && <p className="text-sm text-sun-teal" role="status">{msg}</p>}

        {stats && !stats.can_verify ? (
          <div className="sun-card p-5">
            <p className="font-semibold">Verifying is paused for you</p>
            <p className="text-sun-muted mt-1">Your trust score is under 50. Log honest deeds to build it back up.</p>
          </div>
        ) : loading ? (
          <div className="sun-card p-5 text-sun-muted">Looking for deeds to check…</div>
        ) : !item ? (
          <div className="sun-card p-6 flex flex-col items-center text-center gap-2">
            <ShieldCheck size={36} className="text-sun-accent" />
            <p className="font-semibold text-lg">All caught up</p>
            <p className="text-sun-muted">No deeds are waiting for you right now. Check back later.</p>
            <button onClick={load} className="sun-button-ghost mt-2">Refresh</button>
          </div>
        ) : (
          <div className="sun-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="sun-chip min-h-[32px] text-sun-text">{categoryLabel(item.category)}</span>
              <span className="sun-chip min-h-[32px] text-sun-text">{item.impact === 'High' ? 'Big' : 'Medium'} deed</span>
              {item.witness_confirmed && (
                <span className="sun-chip min-h-[32px] border-sun-teal text-sun-teal">
                  <UserCheck size={14} className="mr-1" /> Person helped confirmed
                </span>
              )}
            </div>
            <p className="text-2xl font-bold leading-snug">"{item.description}"</p>
            {item.image_url ? (
              <img src={item.image_url} alt="Proof photo sent with this deed" className="w-full max-h-72 object-cover rounded-xl" />
            ) : (
              <p className="text-sm text-sun-muted flex items-center gap-2"><Camera size={14} /> No photo</p>
            )}
            <p className="text-sm text-sun-muted">Logged {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
            <p className="text-sm text-sun-muted">Does this sound like a real, honest good deed?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => vote(false)} disabled={busy} className="sun-button-ghost">
                <ThumbsDown size={18} /> Doubtful
              </button>
              <button onClick={() => vote(true)} disabled={busy} className="sun-button">
                <ThumbsUp size={18} /> Looks real
              </button>
            </div>
            {queue.length > 1 && <p className="text-xs text-sun-muted text-center">{queue.length - 1} more after this</p>}
          </div>
        )}

        <details className="sun-card p-4 text-sm text-sun-muted">
          <summary className="font-semibold text-sun-text cursor-pointer min-h-[32px]">How verification works</summary>
          <ul className="list-disc pl-5 mt-2 flex flex-col gap-1.5">
            <li>Each medium or big deed goes to random people. You never see who posted it.</li>
            <li>It's confirmed when enough verifiers say it looks real, and rejected when two people doubt it.</li>
            <li>The person who was helped can confirm through a link. You'll see a “Person helped confirmed” tag, but the decision is still yours.</li>
            <li>Agreeing with the final outcome: +2 trust and 1 point. Disagreeing: −3 trust.</li>
            <li>New accounts' votes count half until they're 3 days old. You can check the same person at most 3 times a week.</li>
          </ul>
        </details>
      </div>
    </MainLayout>
  );
};

export default Verify;
