import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let supabaseWithClerkContext = null;
let currentClerkUserId = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabase() {
  return supabase;
}

export function isSupabaseConfigured() {
  return supabase !== null;
}

export function setClerkUserId(clerkUserId) {
  currentClerkUserId = clerkUserId;

  if (!supabaseUrl || !supabaseAnonKey) return;

  supabaseWithClerkContext = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'app.settings.clerk_user_id': clerkUserId,
      },
    },
  });
}

export function getClerkUserId() {
  return currentClerkUserId;
}

export function getSupabaseWithClerkContext() {
  if (supabaseWithClerkContext) return supabaseWithClerkContext;
  return supabase;
}