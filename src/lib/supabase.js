import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const GLOBAL_CLIENT_KEY = '__gc_dashboard_supabase_client__';

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  if (globalThis[GLOBAL_CLIENT_KEY]) {
    supabase = globalThis[GLOBAL_CLIENT_KEY];
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-client-info': 'grindctrl-dashboard',
        },
      },
    });
    globalThis[GLOBAL_CLIENT_KEY] = supabase;
  }
}

export function getSupabase() {
  return supabase;
}

export function isSupabaseConfigured() {
  return supabase !== null;
}
