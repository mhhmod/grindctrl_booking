import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* Shared service-role client for the Messenger feature. Server-side only;
   the storefront never talks to Supabase directly — it talks to our API,
   which is what makes tenant isolation enforceable in one place.

   Typed loosely (`SupabaseClient<any>`): messenger tables are managed by
   manual SQL deltas rather than generated Database types, mirroring how
   every other server module in this app accesses its tables. */

let cached: SupabaseClient | null = null;

export function getMessengerServiceClient(): SupabaseClient {
  // An already-built (or injected) client wins: the env check below must not
  // run for a test that deliberately supplied its own client.
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service configuration is missing');
  cached = createClient(url, key, { auth: { persistSession: false } }) as SupabaseClient;
  return cached;
}

/** Test seam: lets integration tests inject a stubbed client without
 *  reaching network. Returns a reset function. */
export function setMessengerServiceClientForTests(client: SupabaseClient | null): () => void {
  const previous = cached;
  cached = client;
  return () => {
    cached = previous;
  };
}