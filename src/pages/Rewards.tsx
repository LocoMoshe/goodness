import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Gift, HeartHandshake, Ticket } from 'lucide-react';
import MainLayout from '@/components/MainLayout';
import { useGoodness } from '@/contexts/GoodnessContext';
import { supabase, errorMessage } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Reward { id: string; partner: string; title: string; description: string | null; cost: number; stock: number | null }
interface Charity { id: string; name: string; description: string; image: string; tokens_donated: number }
interface Redemption { id: string; code: string; created_at: string; rewards: { title: string; partner: string } | null }
interface Txn { id: string; amount: number; type: 'earned' | 'spent' | 'pending'; description: string; date: string }

const Rewards: React.FC = () => {
  const { stats, refresh } = useGoodness();
  const [tab, setTab] = useState<'rewards' | 'donate' | 'history'>('rewards');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [codes, setCodes] = useState<Redemption[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [result, setResult] = useState<{ code: string; title: string; partner: string } | null>(null);
  const [donateTo, setDonateTo] = useState<Charity | null>(null);
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const points = stats?.points ?? 0;

  const load = useCallback(async () => {
    const [r, c, rd, t] = await Promise.all([
      supabase.from('rewards').select('id, partner, title, description, cost, stock').order('cost'),
      supabase.rpc('get_charities'),
      supabase.from('redemptions').select('id, code, created_at, rewards(title, partner)').order('created_at', { ascending: false }),
      supabase.from('transactions').select('id, amount, type, description, date').order('date', { ascending: false }).limit(50),
    ]);
    setRewards((r.data as Reward[]) ?? []);
    setCharities((c.data as Charity[]) ?? []);
    setCodes((rd.data as unknown as Redemption[]) ?? []);
    setTxns((t.data as Txn[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('redeem_reward', { p_reward: confirm.id });
    setBusy(false);
    if (e) {
      setError(errorMessage(e));
      return;
    }
    setConfirm(null);
    setResult(data as { code: string; title: string; partner: string });
    refresh();
    load();
  };

  const donate = async () => {
    if (!donateTo) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('donate', { p_charity: donateTo.id, p_amount: amount });
    setBusy(false);
    if (e) {
      setError(errorMessage(e));
      return;
    }
    setNote(`You gave ${amount} points to ${donateTo.name}. Thank you.`);
    setDonateTo(null);
    refresh();
    load();
  };

  return (
    <MainLayout title="Rewards">
      <div className="px-6 flex flex-col gap-5">
        <section className="sun-card p-5">
          <p className="text-sm text-sun-muted">Your points</p>
          <p className="text-5xl font-bold text-sun-accent mt-1">{points}</p>
          {!!stats?.pending_points && (
            <p className="text-sm text-sun-muted mt-1">+{stats.pending_points} waiting for verification</p>
          )}
        </section>

        {note && <p className="text-sm text-sun-teal" role="status">{note}</p>}

        <div className="grid grid-cols-3 gap-1 p-1 bg-sun-surface rounded-2xl border border-sun-line" role="tablist">
          {(['rewards', 'donate', 'history'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[44px] rounded-xl font-semibold text-sm capitalize ${tab === t ? 'bg-sun-accent text-white' : 'text-sun-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'rewards' && (
          <div className="flex flex-col gap-3">
            {rewards.length === 0 && <p className="text-sun-muted">No partner rewards yet. They're coming soon.</p>}
            {rewards.map((r) => {
              const enough = points >= r.cost;
              return (
                <div key={r.id} className="sun-card p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sun-line flex items-center justify-center shrink-0">
                    <Gift size={22} className="text-sun-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-sm text-sun-muted truncate">{r.partner}</p>
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setConfirm(r);
                    }}
                    disabled={!enough}
                    className={`min-h-[44px] px-4 rounded-xl font-bold text-sm ${enough ? 'bg-sun-accent text-white' : 'bg-sun-line text-sun-muted'}`}
                  >
                    {r.cost} pts
                  </button>
                </div>
              );
            })}

            {codes.length > 0 && (
              <section className="flex flex-col gap-2 mt-2">
                <h2 className="font-semibold text-sun-muted">Your codes</h2>
                {codes.map((c) => (
                  <div key={c.id} className="sun-card p-4 flex items-center gap-3">
                    <Ticket size={20} className="text-sun-accent shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{c.rewards?.title ?? 'Reward'}</p>
                      <p className="text-sm text-sun-muted">{c.rewards?.partner} · {format(new Date(c.created_at), 'd MMM')}</p>
                    </div>
                    <span className="font-mono font-bold tracking-wider text-sun-accent">{c.code}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {tab === 'donate' && (
          <div className="flex flex-col gap-3">
            <p className="text-sun-muted text-sm">Turn your points into support for a cause. Totals show how much the community has given.</p>
            {charities.map((c) => (
              <div key={c.id} className="sun-card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">{c.image}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-sun-muted">{c.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sun-muted">{c.tokens_donated} points given</span>
                  <button
                    onClick={() => {
                      setError(null);
                      setAmount(Math.min(10, Math.max(points, 1)));
                      setDonateTo(c);
                    }}
                    disabled={points < 1}
                    className="min-h-[44px] px-4 rounded-xl font-semibold text-sm border border-sun-accent text-sun-accent disabled:opacity-40"
                  >
                    <HeartHandshake size={16} className="inline mr-1" /> Donate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div className="sun-card divide-y divide-sun-line">
            {txns.length === 0 && <p className="p-4 text-sun-muted">No points yet. They arrive when your deeds get verified.</p>}
            {txns.map((t) => (
              <div key={t.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.description}</p>
                  <p className="text-sm text-sun-muted">{format(new Date(t.date), 'd MMM, HH:mm')}</p>
                </div>
                <span className={`font-bold ${t.type === 'earned' ? 'text-sun-accent' : 'text-sun-muted'}`}>
                  {t.type === 'spent' ? '−' : '+'}{t.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="bg-sun-surface border-sun-line rounded-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>
              {confirm?.partner}{confirm?.description ? `: ${confirm.description}` : ''}. This uses {confirm?.cost} of your {points} points.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-sun-danger">{error}</p>}
          <button onClick={redeem} disabled={busy} className="sun-button w-full">
            {busy ? 'Getting your code…' : `Redeem for ${confirm?.cost} points`}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="bg-sun-surface border-sun-line rounded-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Here's your code</DialogTitle>
            <DialogDescription>Show it at {result?.partner}. It's also saved under Your codes.</DialogDescription>
          </DialogHeader>
          <p className="text-4xl font-mono font-bold tracking-[0.2em] text-sun-accent text-center py-4">{result?.code}</p>
          <button onClick={() => setResult(null)} className="sun-button w-full">Done</button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!donateTo} onOpenChange={(o) => !o && setDonateTo(null)}>
        <DialogContent className="bg-sun-surface border-sun-line rounded-2xl w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Donate to {donateTo?.name}</DialogTitle>
            <DialogDescription>You have {points} points.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {[10, 25, 50].map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                disabled={a > points}
                className={`min-h-[48px] rounded-xl font-bold ${amount === a ? 'bg-sun-accent text-white' : 'bg-sun-line text-sun-text'} disabled:opacity-30`}
              >
                {a}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-sun-danger">{error}</p>}
          <button onClick={donate} disabled={busy || amount > points} className="sun-button w-full">
            {busy ? 'Sending…' : `Give ${amount} points`}
          </button>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default Rewards;
