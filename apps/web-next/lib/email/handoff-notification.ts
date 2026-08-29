import type { MessengerLocale } from '@/lib/messenger/types';

/* Plain-string template rather than the react-email path used by the
   Try-On campaign: this is a short internal alert, not a designed campaign,
   and a pure function keeps the wording under test without a renderer. */

export interface HandoffNotificationInput {
  storeName: string;
  siteId: string;
  locale: MessengerLocale;
  /** Email, name, or a generic "anonymous shopper" label. */
  shopperLabel: string;
  reason: string;
  summary: string;
  recentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

const COPY = {
  en: {
    subject: (store: string) => `A shopper needs you — ${store}`,
    heading: 'A shopper is waiting for a human',
    shopper: 'Shopper',
    why: 'Why it escalated',
    recent: 'Last few messages',
    cta: 'Open the conversation',
    footer: 'You are receiving this because Store Chat handed a conversation to your team.',
  },
  ar: {
    subject: (store: string) => `عميل ينتظر ردك — ${store}`,
    heading: 'عميل ينتظر التحدث مع شخص من فريقك',
    shopper: 'العميل',
    why: 'سبب التحويل',
    recent: 'آخر الرسائل',
    cta: 'افتح المحادثة',
    footer: 'تصلك هذه الرسالة لأن دردشة المتجر حوّلت محادثة إلى فريقك.',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* Shopper content is untrusted. Left raw, a newline in a message lets a
   shopper forge a fake "Open the conversation" line above the real CTA in
   the newline-delimited text body — a phishing vector against the
   merchant. Collapse whitespace and cap length everywhere shopper text is
   interpolated. */
function clip(value: string, max = 400): string {
  return value.replace(/\s+/g, ' ').slice(0, max);
}

function speaker(role: 'user' | 'assistant' | 'system', locale: MessengerLocale): string {
  if (role === 'user') return locale === 'ar' ? 'العميل' : 'Shopper';
  if (role === 'assistant') return locale === 'ar' ? 'المساعد' : 'Assistant';
  return locale === 'ar' ? 'النظام' : 'System';
}

export function buildHandoffNotification(input: HandoffNotificationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const t = COPY[input.locale === 'ar' ? 'ar' : 'en'];
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const link = `https://grindctrl.cloud/dashboard/messenger?site=${encodeURIComponent(input.siteId)}&tab=conversations`;
  const messages = input.recentMessages.slice(-3);

  const text = [
    t.heading,
    '',
    `${t.shopper}: ${input.shopperLabel}`,
    `${t.why}: ${clip(input.summary || input.reason)}`,
    '',
    t.recent,
    ...messages.map((m) => `- ${speaker(m.role, input.locale)}: ${clip(m.content)}`),
    '',
    `${t.cta}: ${link}`,
    '',
    t.footer,
  ].join('\n');

  const html = `<!doctype html><html dir="${dir}"><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1c1917;line-height:1.5">
<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(t.heading)}</h2>
<p style="margin:0 0 4px"><strong>${escapeHtml(t.shopper)}:</strong> ${escapeHtml(input.shopperLabel)}</p>
<p style="margin:0 0 16px"><strong>${escapeHtml(t.why)}:</strong> ${escapeHtml(input.summary || input.reason)}</p>
<p style="margin:0 0 6px;font-weight:600">${escapeHtml(t.recent)}</p>
<ul style="margin:0 0 20px;padding-inline-start:18px">
${messages.map((m) => `<li><strong>${escapeHtml(speaker(m.role, input.locale))}:</strong> ${escapeHtml(clip(m.content))}</li>`).join('\n')}
</ul>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="background:#2a2826;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${escapeHtml(t.cta)}</a></p>
<p style="margin:0;font-size:12px;color:#78716c">${escapeHtml(t.footer)}</p>
</body></html>`;

  return { subject: t.subject(input.storeName), html, text };
}
