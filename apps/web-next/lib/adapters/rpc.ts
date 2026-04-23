import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function callRpc<T>(fn: string, params: Record<string, unknown>) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc(fn, params);

  if (error) {
    throw new Error(`${fn} failed: ${error.message}`);
  }

  return data as T;
}
