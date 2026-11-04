import 'server-only';

import { createHmac } from 'node:crypto';
import { coreCapabilitySecret } from '@/lib/security/capability-key';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Derive the plugin-held secret for one site and version. The core secret
 * stays server-only; only the derived value is returned by a successful
 * one-time-code pairing response. */
export function deriveWooSiteSecret(siteId: string, version: number): string | null {
  if (!UUID_RE.test(siteId) || !Number.isSafeInteger(version) || version < 1) return null;

  const core = coreCapabilitySecret();
  if (!core) return null;

  return createHmac('sha256', core)
    .update(`woo-site:${siteId}:v${version}`, 'utf8')
    .digest('base64url');
}
