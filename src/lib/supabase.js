// Supabase client. Reads credentials from env vars (Vite exposes VITE_* to the app).
// If they're not set, `supabaseEnabled` is false and the app runs local-only —
// nothing about the existing experience changes until you add your keys.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);

export const supabase = supabaseEnabled
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// One row per user holds the whole app-state blob.
export const TABLE = 'planner_state';
