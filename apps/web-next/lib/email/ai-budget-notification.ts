import type { MessengerLocale } from '@/lib/messenger/types';

/* Sent at most once a day per store, when Store Chat's assistant reaches
   the day's AI limit (lib/messenger/ai-budget.ts). Shoppers keep writing;
   their messages go to the team, so this tells the merchant where to look. */

const COPY = {
  en: {
    subject: (store: string) => `Store Chat reached today's AI limit: ${store}`,
    heading: 'The assistant reached today’s limit',
    body: 'New questions today go straight to your team in the Inbox, and shoppers see that your team will reply in the chat. The assistant answers again tomorrow (UTC).',
    cta: 'Open the Inbox',
    footer: 'You receive this at most once a day, when Store Chat reaches its daily AI limit.',
  },
  ar: {
    subject: (store: string) => `وصلت دردشة المتجر لحد الذكاء الاصطناعي اليوم: ${store}`,
    heading: 'وصل المساعد لحد اليوم',
    body: 'الأسئلة الجديدة اليوم تصل مباشرة إلى فريقك في صندوق الوارد، ويرى العملاء أن فريقك سيرد في المحادثة. يعود المساعد للرد غدًا (بتوقيت UTC).',
    cta: 'افتح صندوق الوارد',
    footer: 'تصلك هذه الرسالة مرة واحدة في اليوم على الأكثر، عندما تصل دردشة المتجر لحدها اليومي.',
  },
} as const;

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function buildAiBudgetNotification(input: { storeName: string; siteId: string; locale: MessengerLocale }) {
  const t = COPY[input.locale === 'ar' ? 'ar' : 'en'];
  const dir = input.locale === 'ar' ? 'rtl' : 'ltr';
  const storeName = input.storeName.replace(/\s+/g, ' ').slice(0, 120);
  const link = `https://grindctrl.cloud/dashboard/inbox?site=${encodeURIComponent(input.siteId)}`;
  const text = [t.heading, '', t.body, '', `${t.cta}: ${link}`, '', t.footer].join('\n');
  const html = `<!doctype html><html dir="${dir}"><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1c1917;line-height:1.5">
<h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(t.heading)}</h2>
<p style="margin:0 0 20px">${escapeHtml(t.body)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="background:#2a2826;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${escapeHtml(t.cta)}</a></p>
<p style="margin:0;font-size:12px;color:#78716c">${escapeHtml(t.footer)}</p>
</body></html>`;
  return { subject: t.subject(storeName), html, text };
}
