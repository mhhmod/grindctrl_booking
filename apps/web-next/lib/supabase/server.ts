import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from '@/lib/env';

export function createSupabaseServerClient() {
  const env = getSupabaseEnv();

  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'x-client-info': 'grindctrl-web-next',
      },
    },
  });
}
