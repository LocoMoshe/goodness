import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import MainLayout from '@/components/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useGoodness } from '@/contexts/GoodnessContext';

interface Note { id: string; title: string; message: string; read: boolean; created_at: string }

const Notifications: React.FC = () => {
  const { refresh, unread } = useGoodness();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as Note[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markAll = async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    setItems((xs) => xs.map((n) => ({ ...n, read: true })));
    refresh();
  };

  return (
    <MainLayout
      title="Notifications"
      showBack
      headerRight={
        unread > 0 ? (
          <button onClick={markAll} className="text-sun-accent text-sm font-semibold min-h-[44px]">Mark all read</button>
        ) : undefined
      }
    >
      <div className="px-6">
        <div className="sun-card divide-y divide-sun-line">
          {loading && <p className="p-4 text-sun-muted">Loading…</p>}
          {!loading && items.length === 0 && <p className="p-4 text-sun-muted">Nothing here yet.</p>}
          {items.map((n) => (
            <div key={n.id} className="p-4 flex gap-3">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-transparent' : 'bg-sun-accent'}`} />
              <div className="flex-1">
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm text-sun-muted">{n.message}</p>
                <p className="text-xs text-sun-muted mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Notifications;
