import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  requestShakePermission,
  setShakeEnabledPref,
  shakeEnabledPref,
  shakeNeedsPermission,
  shakeSupported,
  useShake,
} from '@/hooks/useShake';
import { shakeFeedback, unlockSound } from '@/lib/feedback';

export type Category = 'Environmental' | 'Social Good' | 'Charitable' | 'Educational' | 'Personal Help';
export type Impact = 'Low' | 'Medium' | 'High';

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'Personal Help', label: 'Personal help' },
  { value: 'Environmental', label: 'Environment' },
  { value: 'Charitable', label: 'Charity' },
  { value: 'Educational', label: 'Teaching' },
  { value: 'Social Good', label: 'Community' },
];

export interface Draft {
  id: string;
  description: string;
  created_at: string;
}

export const categoryLabel = (c: Category) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

export interface Stats {
  name: string;
  avatar: string | null;
  bio: string | null;
  is_public: boolean;
  notifications_enabled: boolean;
  trust: number;
  points: number;
  pending_points: number;
  deeds_today: number;
  deeds_this_week: number;
  total_deeds: number;
  streak: number;
  week: boolean[];
  can_verify: boolean;
  votes_cast: number;
  votes_agreed: number;
  votes_settled: number;
  verify_queue_size: number;
}

interface GoodnessContextType {
  session: Session | null;
  loading: boolean;
  stats: Stats | null;
  unread: number;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  quickLogOpen: boolean;
  openQuickLog: () => void;
  draft: Draft | null;
  openDraft: (d: Draft) => void;
  closeQuickLog: () => void;
  shakeOn: boolean;
  shakeAvailable: boolean;
  motionAlive: boolean;
  enableShake: () => Promise<boolean>;
  disableShake: () => void;
}

const GoodnessContext = createContext<GoodnessContextType | undefined>(undefined);

export const GoodnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unread, setUnread] = useState(0);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [shakeOn, setShakeOn] = useState<boolean>(() => shakeEnabledPref());

  const refresh = useCallback(async () => {
    const [{ data: s }, { count }] = await Promise.all([
      supabase.rpc('get_my_stats'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
    ]);
    if (s) setStats(s as Stats);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setStats(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  // Refresh when the app comes back to the foreground (e.g. after a deed gets verified)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && session) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [session, refresh]);

  // iPhone forgets motion permission every time the app opens. It only lets us ask
  // again during a real tap (touchend/click, not touchstart), so re-ask on the first one.
  const [motionAlive, setMotionAlive] = useState(false);
  useEffect(() => {
    if (!shakeOn || !shakeNeedsPermission() || motionAlive) return;
    const ask = () => {
      requestShakePermission();
    };
    window.addEventListener('touchend', ask);
    window.addEventListener('click', ask);
    return () => {
      window.removeEventListener('touchend', ask);
      window.removeEventListener('click', ask);
    };
  }, [shakeOn, motionAlive]);

  // Sound needs a tap before it can play; keep it awake on every tap while shake is on
  useEffect(() => {
    if (!shakeOn) return;
    window.addEventListener('touchend', unlockSound);
    window.addEventListener('click', unlockSound);
    return () => {
      window.removeEventListener('touchend', unlockSound);
      window.removeEventListener('click', unlockSound);
    };
  }, [shakeOn]);

  const openQuickLog = useCallback(() => {
    setDraft(null);
    setQuickLogOpen(true);
  }, []);
  const openDraft = useCallback((d: Draft) => {
    setDraft(d);
    setQuickLogOpen(true);
  }, []);
  const openFromShake = useCallback(() => {
    shakeFeedback();
    setDraft(null);
    setQuickLogOpen(true);
  }, []);
  const closeQuickLog = useCallback(() => setQuickLogOpen(false), []);

  const markAlive = useCallback(() => setMotionAlive(true), []);
  useShake(openFromShake, shakeOn && !!session && !quickLogOpen, markAlive);

  const enableShake = async () => {
    unlockSound();
    const ok = await requestShakePermission();
    setShakeEnabledPref(ok);
    setShakeOn(ok);
    return ok;
  };
  const disableShake = () => {
    setShakeEnabledPref(false);
    setShakeOn(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <GoodnessContext.Provider
      value={{
        session,
        loading,
        stats,
        unread,
        refresh,
        signOut,
        quickLogOpen,
        draft,
        openDraft,
        openQuickLog,
        closeQuickLog,
        shakeOn,
        shakeAvailable: shakeSupported(),
        motionAlive,
        enableShake,
        disableShake,
      }}
    >
      {children}
    </GoodnessContext.Provider>
  );
};

export const useGoodness = () => {
  const ctx = useContext(GoodnessContext);
  if (!ctx) throw new Error('useGoodness must be used within a GoodnessProvider');
  return ctx;
};
