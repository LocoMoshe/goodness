import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Share2, X, Copy } from 'lucide-react';
import { supabase, errorMessage } from '@/integrations/supabase/client';
import { CATEGORIES, Category, Impact, categoryLabel, useGoodness } from '@/contexts/GoodnessContext';

const KEYWORDS: [Category, string[]][] = [
  ['Environmental', ['recycl', 'tree', 'plant', 'trash', 'litter', 'rubbish', 'garbage', 'beach', 'park', 'compost', 'bike', 'clean up', 'cleaned up', 'nature']],
  ['Charitable', ['donat', 'gave', 'give', 'charity', 'money', 'clothes', 'food bank', 'shelter', 'blood']],
  ['Educational', ['teach', 'tutor', 'explain', 'lesson', 'homework', 'mentor', 'showed', 'learn']],
  ['Social Good', ['volunteer', 'community', 'neighborhood', 'neighbourhood', 'event', 'organi', 'school', 'mosque', 'church']],
];

const guessCategory = (text: string): Category => {
  const t = text.toLowerCase();
  for (const [cat, words] of KEYWORDS) if (words.some((w) => t.includes(w))) return cat;
  return 'Personal Help';
};

const SIZES: { impact: Impact; label: string; reward: string; hint: string }[] = [
  { impact: 'Low', label: 'Small', reward: 'trust', hint: 'Holding a door, a kind word' },
  { impact: 'Medium', label: 'Medium', reward: '+15', hint: 'Real help, checked by 3 people' },
  { impact: 'High', label: 'Big', reward: '+25', hint: 'Needs a photo, checked by 3 people' },
];

type Done = { impact: Impact; token: string | null };

const QuickLogSheet: React.FC = () => {
  const { quickLogOpen, closeQuickLog, refresh, session, stats } = useGoodness();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('Personal Help');
  const [pickedCategory, setPickedCategory] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<Impact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickLogOpen) {
      setText('');
      setCategory('Personal Help');
      setPickedCategory(false);
      setShowCategories(false);
      setPhoto(null);
      setPhotoPreview(null);
      setError(null);
      setDone(null);
      setCopied(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [quickLogOpen]);

  useEffect(() => {
    if (!pickedCategory) setCategory(guessCategory(text));
  }, [text, pickedCategory]);

  if (!quickLogOpen) return null;

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      setError('That photo is over 8 MB. Try a smaller one.');
      return;
    }
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
    setError(null);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photo || !session) return null;
    const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${session.user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('proofs').upload(path, photo, {
      contentType: photo.type || 'image/jpeg',
    });
    if (upErr) throw upErr;
    return supabase.storage.from('proofs').getPublicUrl(path).data.publicUrl;
  };

  const submit = async (impact: Impact) => {
    setError(null);
    if (text.trim().length < 3) {
      setError('Write a few words about what you did.');
      inputRef.current?.focus();
      return;
    }
    if (impact === 'High' && !photo) {
      setError('Big deeds need a photo. Add one, or pick Medium.');
      return;
    }
    setBusy(impact);
    try {
      const imageUrl = await uploadPhoto();
      const { data, error: rpcErr } = await supabase.rpc('log_deed', {
        p_description: text.trim(),
        p_category: category,
        p_impact: impact,
        p_image_url: imageUrl,
      });
      if (rpcErr) throw rpcErr;
      const res = data as { witness_token: string };
      setDone({ impact, token: impact === 'Low' ? null : res.witness_token });
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmLink = done?.token ? `${window.location.origin}/confirm/${done.token}` : '';

  const share = async () => {
    const message = `Hey! I just logged helping you on Goodness. Could you tap this to confirm it happened? ${confirmLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Confirm my good deed', text: message, url: confirmLink });
        return;
      } catch {
        /* cancelled: fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-sun-bg flex flex-col animate-sheet-up" role="dialog" aria-modal="true" aria-label="Log a good deed">
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col px-6 safe-top safe-bottom gap-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.08em] text-sun-accent">{done ? 'LOGGED' : 'QUICK LOG'}</span>
          <button
            onClick={closeQuickLog}
            aria-label="Close"
            className="w-11 h-11 rounded-full bg-sun-surface border border-sun-line flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col gap-6">
            <div className="w-16 h-16 rounded-full bg-sun-accent text-white flex items-center justify-center">
              <Check size={32} strokeWidth={3} />
            </div>
            {done.impact === 'Low' ? (
              <>
                <h2 className="text-3xl font-bold leading-tight">Nice. That counts.</h2>
                <p className="text-sun-muted text-lg">
                  Small deeds keep your streak going{stats ? ` (${stats.streak} day${stats.streak === 1 ? '' : 's'})` : ''} and build trust. Points come from deeds the community verifies.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-bold leading-tight">Sent to 3 verifiers.</h2>
                <p className="text-sun-muted text-lg">
                  You'll get {done.impact === 'High' ? 25 : 15} points once they confirm it. Ask the person you helped to confirm it. Verifiers will see it was confirmed, and you get 5 bonus points once it's verified.
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={share} className="sun-button w-full text-lg">
                    <Share2 size={20} /> Ask them to confirm
                  </button>
                  {copied && (
                    <p className="text-sm text-sun-teal flex items-center gap-2">
                      <Copy size={14} /> Message copied. Paste it in WhatsApp or Viber.
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="flex-1" />
            <button onClick={closeQuickLog} className="sun-button-ghost w-full">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-[32px] font-bold leading-tight">One line about the good you just did.</h2>

            <div className="flex flex-col gap-3">
              <label htmlFor="deed-text" className="sun-label">Your deed</label>
              <input
                id="deed-text"
                ref={inputRef}
                className="sun-input"
                value={text}
                maxLength={280}
                onChange={(e) => setText(e.target.value)}
                placeholder="Carried groceries for my neighbour"
                autoComplete="off"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-sun-muted">Sounds like</span>
                <button
                  onClick={() => setShowCategories((v) => !v)}
                  className="sun-chip border-sun-accent text-sun-accent"
                  aria-expanded={showCategories}
                >
                  {categoryLabel(category)} · change
                </button>
              </div>
              {showCategories && (
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        setCategory(c.value);
                        setPickedCategory(true);
                        setShowCategories(false);
                      }}
                      className={`sun-chip ${c.value === category ? 'bg-sun-accent text-white border-sun-accent' : 'text-sun-text'}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Your proof photo" className="w-full h-44 object-cover rounded-2xl" />
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  aria-label="Remove photo"
                  className="absolute top-2 right-2 w-10 h-10 rounded-full bg-sun-bg/80 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="min-h-[56px] rounded-2xl border border-dashed border-sun-line text-sun-text font-semibold flex items-center justify-center gap-2"
              >
                <Camera size={20} /> Add a photo (optional)
              </button>
            )}

            {error && <p className="text-sun-danger text-sm" role="alert">{error}</p>}

            <div className="flex-1" />

            <div className="flex flex-col gap-3 pb-2">
              <p className="text-sm text-sun-muted">Tap the size to log it</p>
              <div className="grid grid-cols-3 gap-3">
                {SIZES.map((s) => (
                  <button
                    key={s.impact}
                    onClick={() => submit(s.impact)}
                    disabled={busy !== null}
                    title={s.hint}
                    className={`min-h-[96px] rounded-2xl flex flex-col items-center justify-center gap-1 transition active:scale-[0.97] disabled:opacity-60 ${
                      s.impact === 'Medium' ? 'bg-sun-accent text-white' : 'bg-sun-surface border border-sun-line text-sun-text'
                    }`}
                  >
                    <span className="font-bold text-[17px]">{busy === s.impact ? 'Saving…' : s.label}</span>
                    <span className={`text-sm ${s.impact === 'Medium' ? 'font-semibold' : 'text-sun-muted'}`}>{s.reward}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickLogSheet;
