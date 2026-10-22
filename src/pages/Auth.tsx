import React, { useState } from 'react';
import Logo from '@/components/Logo';
import { supabase, errorMessage } from '@/integrations/supabase/client';

const Auth: React.FC = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (err) throw err;
        if (!data.session) setInfo('Check your email and tap the link to finish signing up.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-sun-bg flex flex-col justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Logo size={56} />
          <h1 className="text-4xl font-bold leading-tight">
            {mode === 'signin' ? 'Welcome back.' : 'Do good. Get it seen.'}
          </h1>
          <p className="text-sun-muted text-lg">
            {mode === 'signin'
              ? 'Sign in to log deeds and verify others.'
              : 'Log good deeds with a shake. The community verifies them, and you turn points into rewards.'}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="sun-label">First name</label>
              <input id="name" className="sun-input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="given-name" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="sun-label">Email</label>
            <input id="email" type="email" className="sun-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="sun-label">Password</label>
            <input
              id="password"
              type="password"
              className="sun-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>
          {error && <p className="text-sm text-sun-danger" role="alert">{error}</p>}
          {info && <p className="text-sm text-sun-teal" role="status">{info}</p>}
          <button type="submit" disabled={busy} className="sun-button w-full text-lg mt-2">
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
          className="text-sun-accent font-semibold min-h-[44px]"
        >
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
