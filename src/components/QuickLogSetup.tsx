import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { supabase, errorMessage } from '@/integrations/supabase/client';

const ENDPOINT = 'https://goodness-sigma.vercel.app/api/quick';

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard blocked: the text is still selectable */
        }
      }}
      aria-label={`Copy ${label}`}
      className="shrink-0 min-h-[44px] px-3 rounded-xl bg-sun-accent text-white font-semibold flex items-center gap-1.5"
    >
      {done ? <Check size={16} /> : <Copy size={16} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
};

const Field: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="flex items-center gap-2">
    <code className="flex-1 min-w-0 break-all select-all rounded-xl bg-sun-bg border border-sun-line px-3 py-2 text-[13px]">{value}</code>
    <CopyButton value={value} label={label} />
  </div>
);

const QuickLogSetup: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('has_quick_key').then(({ data }) => setHasKey(!!data));
  }, []);

  const makeKey = async () => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('create_quick_key');
    setBusy(false);
    if (e) return setError(errorMessage(e));
    setKey(data as string);
    setHasKey(true);
  };

  const turnOff = async () => {
    setBusy(true);
    await supabase.rpc('remove_quick_key');
    setBusy(false);
    setKey(null);
    setHasKey(false);
  };

  return (
    <section className="sun-card p-4 flex flex-col gap-3">
      <div>
        <p className="font-semibold">Log from anywhere</p>
        <p className="text-sm text-sun-muted">
          Double-tap the back of your iPhone to jot down a deed, even when the app is closed. It waits here until you finish it.
        </p>
      </div>

      {!key && (
        <div className="flex flex-wrap gap-2">
          <button onClick={makeKey} disabled={busy || hasKey === null} className="sun-button px-5 disabled:opacity-60">
            {hasKey ? 'Make a new key' : 'Set it up'}
          </button>
          {hasKey && (
            <button onClick={turnOff} disabled={busy} className="sun-button-ghost px-5">
              Turn off
            </button>
          )}
        </div>
      )}
      {hasKey && !key && (
        <p className="text-sm text-sun-teal">Quick log is on. A new key stops the old one from working.</p>
      )}
      {error && <p className="text-sm text-sun-danger" role="alert">{error}</p>}

      {key && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Your key (shown once, keep it private)</p>
          <Field value={key} label="key" />

          <ol className="flex flex-col gap-3 text-[15px] list-decimal pl-5 marker:font-bold marker:text-sun-accent">
            <li>
              Open the <b>Shortcuts</b> app, tap <b>+</b> and name it <b>Log a good deed</b>.
            </li>
            <li>
              Add <b>Ask for Input</b>. Set the question to <i>What good did you do?</i>
            </li>
            <li className="flex flex-col gap-2">
              <span>
                Add <b>Get Contents of URL</b> and paste this address:
              </span>
              <Field value={ENDPOINT} label="address" />
              <span>
                Tap the arrow on that action. Set <b>Method</b> to <b>POST</b> and <b>Request Body</b> to <b>JSON</b>. Add two
                Text fields:
              </span>
              <span>
                <b>key</b> → paste your key
                <br />
                <b>text</b> → pick <b>Provided Input</b>
              </span>
            </li>
            <li>
              Add <b>Show Notification</b> and pick <b>Contents of URL</b>.
            </li>
            <li>
              In iPhone <b>Settings › Accessibility › Touch › Back Tap › Double Tap</b>, choose <b>Log a good deed</b>.
            </li>
          </ol>
          <p className="text-sm text-sun-muted">You can also run it from the Action Button or say "Hey Siri, log a good deed".</p>
          <button onClick={() => setKey(null)} className="sun-button-ghost">
            Done
          </button>
        </div>
      )}
    </section>
  );
};

export default QuickLogSetup;
