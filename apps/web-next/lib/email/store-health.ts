import type { StoreHealthProblem } from '@/lib/store-health/problems';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type StoreHealthEmailInput = {
  problem: StoreHealthProblem;
  recovery: boolean;
  storeName: string;
  address: string;
  locale: SiteLocale;
  sinceDay: string;
};

const PRODUCTS = {
  en: { code_gone: 'Try-On', tryon_out_of_looks: 'Try-On', store_chat_down: 'Store Chat', product_details_missing: 'Try-On', product_photos_blocked: 'Try-On' },
  ar: { code_gone: 'القياس الافتراضي', tryon_out_of_looks: 'القياس الافتراضي', store_chat_down: 'محادثة المتجر', product_details_missing: 'القياس الافتراضي', product_photos_blocked: 'القياس الافتراضي' },
};
const COPY = {
  en: {
    fix: 'Fix it in 1 minute', manage: 'Manage alerts', footer: 'You get this email only when something stops working.',
    theme: 'Usually a theme change removed your code.', reinstall: 'Putting it back takes about a minute.',
    seen: 'We saw your code a few minutes ago.', done: 'There is nothing else to do.',
    problems: {
      tryon_out_of_looks: 'shoppers can’t use Try-On because your store has run out of looks.',
      store_chat_down: 'shoppers can’t see Store Chat on your store.',
      product_details_missing: 'Try-On can’t read the product details on your store.',
      product_photos_blocked: 'Try-On can’t load the product photos on your store.',
    },
    next: {
      tryon_out_of_looks: 'The Try-On button is hidden from shoppers until you add looks.',
      store_chat_down: 'Usually Store Chat was switched off or your code was removed. Your Store check shows which.',
      product_details_missing: 'Try-On needs each product page to say which product it is. One line fixes it.',
      product_photos_blocked: 'Your photos come from a host we have not allowed yet. Reply to this email and we will add it.',
    },
    actions: {
      tryon_out_of_looks: 'Add looks',
      store_chat_down: 'See what to fix',
      product_details_missing: 'See the one-line fix',
      product_photos_blocked: 'See the details',
    },
  },
  ar: {
    fix: 'أصلحه في دقيقة', manage: 'إدارة التنبيهات', footer: 'تصلك هذه الرسالة فقط عندما يتوقف شيء عن العمل.',
    theme: 'غالبًا حذف تغييرٌ في القالب الكود.', reinstall: 'إعادته تأخذ نحو دقيقة.',
    seen: 'رأينا الكود قبل دقائق.', done: 'لا يلزمك فعل أي شيء.',
    problems: {
      tryon_out_of_looks: 'لا يستطيع المتسوقون استخدام القياس الافتراضي لأن رصيد الإطلالات في متجرك نفد.',
      store_chat_down: 'لا يرى المتسوقون محادثة المتجر على متجرك.',
      product_details_missing: 'لا يستطيع القياس الافتراضي قراءة تفاصيل المنتجات على متجرك.',
      product_photos_blocked: 'لا يستطيع القياس الافتراضي تحميل صور المنتجات على متجرك.',
    },
    next: {
      tryon_out_of_looks: 'زر القياس مخفي عن المتسوقين حتى تضيف إطلالات.',
      store_chat_down: 'غالبًا أُوقفت محادثة المتجر أو حُذف الكود. يوضح فحص المتجر السبب.',
      product_details_missing: 'يحتاج القياس الافتراضي أن تذكر كل صفحة منتج اسم المنتج. سطر واحد يحل ذلك.',
      product_photos_blocked: 'صورك تأتي من مصدر لم نسمح به بعد. ردّ على هذه الرسالة وسنضيفه.',
    },
    actions: {
      tryon_out_of_looks: 'أضف إطلالات',
      store_chat_down: 'اعرف ما يجب إصلاحه',
      product_details_missing: 'اعرف السطر المطلوب',
      product_photos_blocked: 'اعرف التفاصيل',
    },
  },
};
const clean = (s: string) => s.replace(/[\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 253);
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** Pack A A7.1/A7.2, with the requested cream/charcoal email palette.
 * The existing handoff emails have no legal line; Grind CTRL is the legal
 * operator name already used by the privacy emails. No images or webfonts. */
export function buildStoreHealthEmail(input: StoreHealthEmailInput): { subject: string; html: string; text: string } {
  const ar = input.locale === 'ar';
  const t = COPY[input.locale];
  const store = clean(input.storeName);
  const address = clean(input.address);
  const product = PRODUCTS[input.locale][input.problem];
  const link = `https://grindctrl.cloud/dashboard/store#check-${input.problem}`;
  const manage = 'https://grindctrl.cloud/dashboard/store#alerts';
  const subject = input.recovery
    ? (ar ? `عاد يعمل على ${address}` : `It's working again on ${address}`)
    : input.problem === 'code_gone'
      ? (ar ? `توقف ظهور القياس الافتراضي على ${address}` : `Try-On stopped showing on ${address}`)
      : (ar ? `توقف ${product} عن العمل على ${address}` : `${product} stopped working on ${address}`);
  const heading = input.recovery
    ? (ar ? `مرحبًا ${store}، عاد ${product} للظهور على متجرك.` : `Hi ${store}, ${product} is showing on your store again.`)
    : input.problem === 'code_gone'
      ? (ar ? `مرحبًا ${store}، لا يرى المتسوقون زر القياس الافتراضي على متجرك منذ ${clean(input.sinceDay)}.` : `Hi ${store}, shoppers can't see the Try-On button on your store since ${clean(input.sinceDay)}.`)
      : (ar ? `مرحبًا ${store}، ${t.problems[input.problem]}` : `Hi ${store}, ${t.problems[input.problem]}`);
  const body = input.recovery ? [t.seen, t.done] : input.problem === 'code_gone' ? [t.theme, t.reinstall] : [t.next[input.problem]];
  const action = input.problem === 'code_gone' ? t.fix : t.actions[input.problem];
  const legal = 'Grind CTRL · grindctrl.cloud';
  const text = ['GRINDCTRL', '', heading, ...body, ...(!input.recovery ? ['', `${action}: ${link}`] : []), '', t.footer, `${t.manage}: ${manage}`, legal].join('\n');
  const html = `<!doctype html><html lang="${input.locale}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>@media(max-width:480px){.gc-health-cta{width:100%!important}.gc-health-button{display:block!important;text-align:center!important;padding:0!important}}@media(prefers-color-scheme:dark){.gc-health-bg{background-color:#1f1d1a!important}.gc-health-card{background-color:#292723!important;color:#f6f1e7!important}.gc-health-muted{color:#d7d0c5!important}.gc-health-button{background-color:#f6f1e7!important;color:#1f1d1a!important}}</style></head>
<body class="gc-health-bg" style="margin:0;padding:0;background-color:#f6f1e7;color:#1f1d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;line-height:1.5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:24px 0">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" class="gc-health-card" width="100%" cellspacing="0" cellpadding="0" border="0" dir="${ar ? 'rtl' : 'ltr'}" style="width:100%;max-width:560px;background-color:#ffffff;color:#1f1d1a;border-collapse:collapse;text-align:${ar ? 'right' : 'left'}"><tr><td style="padding:24px;word-break:break-word">
<p style="margin:0 0 24px;font-size:13px;letter-spacing:2px;font-weight:600"><span dir="ltr">GRINDCTRL</span></p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.5;font-weight:600">${escape(heading)}</h1>
${body.map((line) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(line)}</p>`).join('\n')}
${input.recovery ? '' : `<table role="presentation" class="gc-health-cta" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;width:auto"><tr><td bgcolor="#1f1d1a" style="background-color:#1f1d1a;border-radius:8px;text-align:center;mso-padding-alt:0 24px"><a class="gc-health-button" href="${link}" style="display:inline-block;background-color:#1f1d1a;color:#f6f1e7;text-decoration:none;border-radius:8px;padding:0 24px;line-height:48px;min-height:48px;font-weight:600;mso-text-raise:0">${action}</a></td></tr></table>`}
<p class="gc-health-muted" style="margin:24px 0 8px;color:#6b655b;font-size:13px;line-height:1.5">${t.footer}<br><a class="gc-health-muted" href="${manage}" style="color:#6b655b;text-decoration:underline">${t.manage}</a></p>
<p class="gc-health-muted" style="margin:0;color:#6b655b;font-size:12px;line-height:1.5"><span dir="ltr">${legal}</span></p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  return { subject: ar ? subject.replace(address, `\u2066${address}\u2069`) : subject, html, text };
}
