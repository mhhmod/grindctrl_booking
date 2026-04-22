import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { getEnv } from './env.ts';

let _service: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (_service) return _service;
  const url = getEnv('SUPABASE_URL');
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  _service = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-client-info': 'grindctrl-widget-edge' } }
  });
  return _service;
}
