import type { SpendUsage } from '@/lib/spend/snapshot';
export type SpendEmailInput = SpendUsage & { threshold: 80 | 100; topStores: Array<{ store: string; used: number }> };
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const clean = (s: string) => s.replace(/[\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 253);

export function buildSpendEmail(input: SpendEmailInput): { subject: string; html: string; text: string } {
  const heading = input.store
    ? 'Store ' + clean(input.store) + ' hit its daily limit'
    : input.feature + ' reached ' + input.threshold + '% of its daily ceiling';
  const facts = [ ['Feature', input.feature], ['Used', String(input.used)], ['Limit', String(input.limit)],
    ...input.topStores.slice(0, 3).map((row, i) => ['Top store ' + (i + 1), clean(row.store) + ': ' + row.used]),
  ];
  const link = 'https://grindctrl.cloud/dashboard/settings';
  const text = ['GRINDCTRL', '', heading, '', ...facts.map(([key, value]) => key + ': ' + value), '',
    'Resets at 00:00 UTC', 'Open operator tools: ' + link, '', 'Grind CTRL \u00b7 grindctrl.cloud'].join('\n');
  // Same cream/charcoal, system fonts, 560px card and 48px CTA as store-health.
  const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>@media(max-width:480px){.gc-health-button{display:block!important;text-align:center!important;padding:0!important}}@media(prefers-color-scheme:dark){.gc-health-bg{background-color:#1f1d1a!important}.gc-health-card{background-color:#292723!important;color:#f6f1e7!important}.gc-health-muted{color:#d7d0c5!important}.gc-health-button{background-color:#f6f1e7!important;color:#1f1d1a!important}}</style></head><body class="gc-health-bg" style="margin:0;background-color:#f6f1e7;color:#1f1d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.5"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 0"><table role="presentation" class="gc-health-card" width="100%" style="width:100%;max-width:560px;background-color:#ffffff;color:#1f1d1a;border-collapse:collapse"><tr><td style="padding:24px;word-break:break-word"><p style="margin:0 0 24px;font-size:13px;letter-spacing:2px;font-weight:600">GRINDCTRL</p><h1 style="margin:0 0 16px;font-size:20px;line-height:1.5">${escape(heading)}</h1><table style="width:100%;border-collapse:collapse;text-align:left">${facts.map(([key, value]) => '<tr><th scope="row" style="padding:8px">' + escape(key) + '</th><td style="padding:8px;overflow-wrap:anywhere">' + escape(value) + '</td></tr>').join('')}</table><p class="gc-health-muted">Resets at 00:00 UTC</p><a class="gc-health-button" href="${link}" style="display:inline-block;background-color:#1f1d1a;color:#f6f1e7;text-decoration:none;border-radius:8px;padding:0 24px;line-height:48px;min-height:48px;font-weight:600">Open operator tools</a><p class="gc-health-muted" style="margin:24px 0 0;color:#6b655b;font-size:12px">Grind CTRL \u00b7 grindctrl.cloud</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: heading, html, text };
}
