import type { YourStoreFacts } from '@/lib/dashboard/your-store-model';

export function healthyFacts(): YourStoreFacts {
  return { now: Date.parse('2026-11-11T12:00:00Z'), timeZone: 'UTC', platform: 'paste_website',
    address: 'lulu.example', storeUrl: 'https://lulu.example', canChange: true, canBilling: true,
    code: { lastSeenAt: '2026-11-11T11:59:00Z', connected: false }, launchState: 'live', codeOutdated: false,
    tryOn: { tenant: 'site:1', showButton: true, looksLeft: 10, looksIncluded: 20, planActive: true, pasteReason: null },
    chat: { siteId: 'site-1', enabled: true }, domains: [],
    health: { inline: 1, floating: 0, detected: 1, missing: 0, photos: 1, photoHost: null, listings: 1, pills: 1 } };
}
