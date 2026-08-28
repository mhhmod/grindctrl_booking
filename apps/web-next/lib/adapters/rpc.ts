import 'server-only';

import { createClient } from '@supabase/supabase-js';

/* Service role, not anon: the dashboard/workspace RPCs take the caller's
   Clerk id as a plain parameter and never verify it, so they are granted to
   service_role only. The trust boundary is this server — every caller must
   have already established the Clerk session it passes down. */
function createRpcClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function callRpc<T>(fn: string, params: Record<string, unknown>) {
  const supabase = createRpcClient();
  const { data, error } = await supabase.rpc(fn, params);

  if (error) {
    throw new Error(`${fn} failed: ${error.message}`);
  }

  return data as T;
}
