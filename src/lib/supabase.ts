import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(url && key);
// A missing configuration renders a setup screen; it never makes requests to this placeholder.
export const supabase = createClient<Database>(
  url || 'https://unconfigured.supabase.co',
  key || 'unconfigured',
);
