import 'server-only';
import { getMessengerServiceClient } from '@/lib/messenger/db';
import { storeHealthEmailsEnabled } from './problems';

/** Caller has already resolved the authenticated active store. */
export async function readStoreHealthEmailPreference(siteId: string): Promise<boolean> {
  const { data, error } = await getMessengerServiceClient().from('widget_sites').select('settings_json').eq('id', siteId).single();
  if (error) throw new Error('store health preference read failed');
  return storeHealthEmailsEnabled(data.settings_json);
}
