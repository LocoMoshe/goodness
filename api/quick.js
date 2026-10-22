// Quick log from an iPhone Shortcut: POST { key, text } -> saves a draft deed.
// Replies in plain text so the Shortcut can show it as a notification.
const SUPABASE_URL = 'https://qizqfvfobcdrxekciqtd.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenFmdmZvYmNkcnhla2NpcXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTk4NTAsImV4cCI6MjEwODE3NTg1MH0.UK0kQ7cuaYDxAk8tgrbY_Be-dHFV-B0hozy9NnkpReQ';

const pick = (obj, ...names) => {
  for (const n of names) if (obj && typeof obj[n] === 'string' && obj[n].trim()) return obj[n].trim();
  return '';
};

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).send('Use POST with your key and text.');
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = Object.fromEntries(new URLSearchParams(body));
    }
  }
  // accept field names in any case ("Key", "TEXT", ...)
  if (body && typeof body === 'object') {
    body = Object.fromEntries(Object.entries(body).map(([k, v]) => [String(k).trim().toLowerCase(), v]));
  }
  const key = pick(body, 'key', 'k') || String(req.headers['x-goodness-key'] || '').trim();
  const text = pick(body, 'text', 't', 'deed');
  if (!key) {
    res.status(400).send('Missing your Goodness key. Copy it from Profile in the app.');
    return;
  }
  if (text.length < 3) {
    res.status(400).send('Write a few words about what you did.');
    return;
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/quick_log`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: key, p_text: text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(400).send(data.message || 'Could not save that. Try again.');
      return;
    }
    const n = data.waiting || 1;
    res.status(200).send(`Saved 💛 ${n} quick note${n === 1 ? '' : 's'} waiting in Goodness Tribe.`);
  } catch {
    res.status(502).send('Could not reach Goodness Tribe. Check your connection and try again.');
  }
}
