import 'server-only';
import { sendShopifyPrivacyAlert } from '@/lib/email/shopify-privacy-sender';
import { recordInstallationEvent, installationEventClient, type InstallationEvent } from './installation-events';

/** Recording is not fulfillment. Shared visitor/conversation/job provenance and
 * legal retention have NOT been approved for multiple installations. Never run
 * the former domain-wide delete, even if the legacy processing flag is enabled.
 * Every request stays manual_required until an operator documents scope and
 * fulfillment evidence. This is an explicit merchant-launch blocker. */
export async function processShopifyPrivacyRequest(input: Omit<InstallationEvent, 'topic'> & {
  topic: 'customers/data_request' | 'customers/redact' | 'shop/redact';
}): Promise<void> {
  const receipt = await recordInstallationEvent(input);
  if (receipt.alertSent || receipt.status === 'completed') return;
  const sent = await sendShopifyPrivacyAlert({
    webhookId: input.webhookId, shopDomain: input.shopDomain, topic: input.topic,
    reason: 'disabled', to: [],
  });
  if (sent.sent) {
    const { error } = await installationEventClient().from('shopify_installation_events')
      .update({ alert_sent_at: new Date().toISOString() }).eq('id', receipt.id);
    if (error) throw new Error('privacy_alert_status_unavailable');
  } else {
    throw new Error('privacy_manual_alert_unavailable');
  }
}
