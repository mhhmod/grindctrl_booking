import 'server-only';
import { easyOrdersRequest } from './client';
import { webhookUrls } from './install';
import { easyOrdersRpc, loadEasyOrdersConnection } from './store';
import { EasyOrdersError } from './types';

export async function disconnectEasyOrdersConnection(siteId: string): Promise<void> {
  const c = await loadEasyOrdersConnection(siteId);
  if (!c || c.status === 'disconnected') return;
  const args = { p_site: siteId, p_token: c.webhook_token };
  if (await easyOrdersRpc('begin_easyorders_disconnect', args) !== true) throw new EasyOrdersError('unavailable');
  if (c.api_key) {
    // Sequential, budgeted, no retry. Keep the key if either deletion fails
    // so the merchant can retry cleanup. Repeated deletion may return 404.
    for (const url of webhookUrls(c.callback_origin, c.webhook_token)) {
      const result = await easyOrdersRequest(c, `webhooks/delete-by-url?${new URLSearchParams({ url })}`, 'DELETE');
      if (!result.ok && result.reason !== 'not_found') throw new EasyOrdersError('unavailable');
    }
  }
  if (await easyOrdersRpc('finish_easyorders_disconnect', args) !== true) throw new EasyOrdersError('unavailable');
}
