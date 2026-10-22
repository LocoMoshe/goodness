import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase, errorMessage } from '@/integrations/supabase/client';

interface WitnessDeed { description: string; author: string; confirmed: boolean; status: string }

// Public page: the person who was helped opens this link, no account needed.
const Confirm: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [deed, setDeed] = useState<WitnessDeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.rpc('get_witness_deed', { p_token: token }).then(({ data, error: e }) => {
      if (e || !data) setError('This link is not valid or has expired.');
      else setDeed(data as WitnessDeed);
      setLoading(false);
    });
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    const { data, error: e } = await supabase.rpc('confirm_witness', { p_token: token });
    setBusy(false);
    if (e) setError(errorMessage(e));
    else setDeed(data as WitnessDeed);
  };

  return (
    <div className="min-h-screen bg-sun-bg flex flex-col justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
        <Logo size={52} />

        {loading && <p className="text-sun-muted">Loading…</p>}
        {error && <p className="text-sun-danger text-lg">{error}</p>}

        {deed && !deed.confirmed && !declined && (
          <>
            <h1 className="text-3xl font-bold leading-tight">Did {deed.author} help you?</h1>
            <p className="text-sm text-sun-muted">{deed.author} logged this on Goodness Tribe:</p>
            <p className="sun-card p-5 text-xl font-semibold">"{deed.description}"</p>
            <p className="text-sun-muted">If it really happened, confirm it. This helps keep Goodness Tribe honest.</p>
            <button onClick={confirm} disabled={busy} className="sun-button w-full text-lg">
              {busy ? 'Confirming…' : 'Yes, this happened'}
            </button>
            <button onClick={() => setDeclined(true)} className="sun-button-ghost w-full">
              No, it didn't
            </button>
          </>
        )}

        {deed && deed.confirmed && (
          <>
            <div className="w-14 h-14 rounded-full bg-sun-teal/20 flex items-center justify-center">
              <Check size={28} className="text-sun-teal" strokeWidth={3} />
            </div>
            <h1 className="text-3xl font-bold leading-tight">Thank you!</h1>
            <p className="text-sun-muted text-lg">You confirmed {deed.author}'s good deed.</p>
          </>
        )}

        {declined && (
          <>
            <h1 className="text-3xl font-bold leading-tight">Thanks for being honest.</h1>
            <p className="text-sun-muted text-lg">We won't count your confirmation. The community will still check it.</p>
          </>
        )}

        {(deed?.confirmed || declined) && (
          <Link to="/auth" className="sun-button-ghost w-full">Do good too: join Goodness Tribe</Link>
        )}
      </div>
    </div>
  );
};

export default Confirm;
