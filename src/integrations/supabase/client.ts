import { createClient } from '@supabase/supabase-js';

// Public project URL and anon key: safe to ship in the app.
// All scoring rules live in the database (supabase/migrations), not here.
const SUPABASE_URL = "https://qizqfvfobcdrxekciqtd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenFmdmZvYmNkcnhla2NpcXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTk4NTAsImV4cCI6MjEwODE3NTg1MH0.UK0kQ7cuaYDxAk8tgrbY_Be-dHFV-B0hozy9NnkpReQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const errorMessage = (e: unknown): string => {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
};
