import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type StoreConnectedEmailInput = {
  storeName: string;
  /** The address shoppers use: the verified domain, the shop or the WordPress home. */
  host: string;
  locale: SiteLocale;
};

const DASHBOARD = 'https://grindctrl.cloud/dashboard/store';

const COPY = {
  en: {
    subject: (host: string) => `Your store is connected: ${host}`,
    heading: (store: string) => `Hi ${store}, your store is connected.`,
    /** Around the host, which is set apart in the HTML. */
    chat: ['Shoppers now see Store Chat on every page of ', '.'],
    tryOn: 'The Try-On button shows on your product pages.',
    action: 'Open your dashboard',
    help: 'Need a hand? Reply to this email and we will help.',
    footer: 'You get this email once, when a store first connects.',
  },
  ar: {
    subject: (host: string) => `تم ربط متجرك: ${host}`,
    heading: (store: string) => `مرحبًا ${store}، تم ربط متجرك.`,
    chat: ['يرى المتسوقون الآن محادثة المتجر في كل صفحات ', '.'],
    tryOn: 'يظهر زر القياس الافتراضي في صفحات منتجاتك.',
    action: 'افتح لوحة التحكم',
    help: 'تحتاج مساعدة؟ ردّ على هذه الرسالة وسنساعدك.',
    footer: 'تصلك هذه الرسالة مرة واحدة، عند ربط المتجر لأول مرة.',
  },
} as const;

const clean = (s: string) => s.replace(/[‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, 253);
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** The "you're connected" email, in the store-health email's look: cream and
 *  charcoal, one button, no images or webfonts. The host is isolated as LTR
 *  inside Arabic text so a domain never reorders the sentence around it. */
export function buildStoreConnectedEmail(input: StoreConnectedEmailInput): { subject: string; html: string; text: string } {
  const ar = input.locale === 'ar';
  const t = COPY[input.locale];
  const store = clean(input.storeName) || clean(input.host);
  const host = clean(input.host);
  const isolate = (s: string) => (ar ? `⁦${s}⁩` : s);
  const heading = t.heading(store);
  const [chatBefore, chatAfter] = t.chat;
  const body = [`${chatBefore}${isolate(host)}${chatAfter}`, t.tryOn];
  const legal = 'Grind CTRL · grindctrl.cloud';
  const text = ['GRINDCTRL', '', heading, ...body, '', `${t.action}: ${DASHBOARD}`, '', t.help, '', t.footer, legal].join('\n');
  const html = `<!doctype html><html lang="${input.locale}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>@media(max-width:480px){.gc-health-cta{width:100%!important}.gc-health-button{display:block!important;text-align:center!important;padding:0!important}}@media(prefers-color-scheme:dark){.gc-health-bg{background-color:#1f1d1a!important}.gc-health-card{background-color:#292723!important;color:#f6f1e7!important}.gc-health-muted{color:#d7d0c5!important}.gc-health-button{background-color:#f6f1e7!important;color:#1f1d1a!important}}</style></head>
<body class="gc-health-bg" style="margin:0;padding:0;background-color:#f6f1e7;color:#1f1d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:24px 0">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" class="gc-health-card" width="100%" cellspacing="0" cellpadding="0" border="0" dir="${ar ? 'rtl' : 'ltr'}" style="width:100%;max-width:560px;background-color:#ffffff;color:#1f1d1a;border-collapse:collapse;text-align:${ar ? 'right' : 'left'}"><tr><td style="padding:24px;word-break:break-word">
<p style="margin:0 0 24px;font-size:13px;letter-spacing:2px;font-weight:600"><span dir="ltr">GRINDCTRL</span></p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.5;font-weight:600">${escape(heading)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(chatBefore)}<span dir="ltr">${escape(host)}</span>${escape(chatAfter)}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(t.tryOn)}</p>
<table role="presentation" class="gc-health-cta" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;width:auto"><tr><td bgcolor="#1f1d1a" style="background-color:#1f1d1a;border-radius:8px;text-align:center;mso-padding-alt:0 24px"><a class="gc-health-button" href="${DASHBOARD}" style="display:inline-block;background-color:#1f1d1a;color:#f6f1e7;text-decoration:none;border-radius:8px;padding:0 24px;line-height:48px;min-height:48px;font-weight:600;mso-text-raise:0">${t.action}</a></td></tr></table>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(t.help)}</p>
<p class="gc-health-muted" style="margin:24px 0 8px;color:#6b655b;font-size:13px;line-height:1.5">${t.footer}</p>
<p class="gc-health-muted" style="margin:0;color:#6b655b;font-size:12px;line-height:1.5"><span dir="ltr">${legal}</span></p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return { subject: t.subject(isolate(host)), html, text };
}
