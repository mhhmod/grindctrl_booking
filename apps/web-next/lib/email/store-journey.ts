import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';
import { buildStoreHealthEmail, type StoreNoticeMessage } from './store-health';

export type StoreJourneyEvent = 'signature' | 'daily_limit' | 'low_looks' | 'disconnected';
export type StoreJourneyEmailInput = { event: StoreJourneyEvent; address: string; storeName: string; locale: SiteLocale;
  looksLeft?: number; resetTime?: string; globalLimit?: boolean };

export function buildStoreJourneyEmail(input: StoreJourneyEmailInput) {
  const ar = input.locale === 'ar';
  const rows = getYourStoreCopy(input.locale).rows;
  const messages: Record<StoreJourneyEvent, StoreNoticeMessage> = {
    signature: { subject: ar ? 'كود القياس يحتاج تحديثًا' : 'Try-On needs your current code', heading: rows.signature,
      body: [ar ? 'رصدنا طلبات تعذّر التحقق منها. افتح إعداد المتجر وانسخ الكود الحالي إلى القالب المنشور، ثم افتح صفحة منتج.' : 'We saw requests we could not verify. Open Store setup, paste the current code into your live theme, then open a product page.'],
      action: ar ? 'احصل على الكود الحالي' : 'Get the current code', href: 'https://grindctrl.cloud/dashboard/store#connect', footer: ar ? 'تنبيه صحة المتجر، مرة واحدة في اليوم.' : 'A store health notice, once per day.' },
    daily_limit: { subject: ar ? 'القياس متوقف لليوم' : 'Try-On is paused for today', heading: rows.dailyLimitReached,
      body: [rows.dailyReset(input.resetTime ?? ''), ...(input.globalLimit ? [rows.sharedCeiling] : [])],
      action: rows.askRaise, href: 'mailto:grindctrlnow@gmail.com', footer: ar ? 'تنبيه الحد اليومي، مرة واحدة في اليوم.' : 'A daily limit notice, once per day.' },
    low_looks: { subject: ar ? 'رصيد الإطلالات منخفض' : 'Your looks are running low', heading: rows.looksLow(input.looksLeft ?? 0),
      body: [ar ? 'بقي 20% أو أقل من إطلالاتك. يعمل الزر الآن، ويختفي عند نفادها حتى تضيف رصيدًا أو تتجدد الباقة.' : 'You have 20% or less of your looks left. The button works now and hides when they run out, until you add looks or the plan renews.'],
      action: rows.topUp, href: 'mailto:grindctrlnow@gmail.com', footer: ar ? 'تنبيه الرصيد، مرة واحدة في اليوم.' : 'A low looks notice, once per day.' },
    disconnected: { subject: ar ? 'تم فصل المتجر عن لوحة التحكم' : 'Store disconnected from your dashboard',
      heading: ar ? 'تم فصل محادثة المتجر عن لوحة تحكم هذا الحساب.' : 'Store Chat was disconnected from this account’s dashboard.',
      body: [ar ? 'تبقى محادثة المتجر في Shopify والقياس الافتراضي والباقة والبيانات كما هي.' : 'Store Chat in Shopify, Try-On, your plan and data stay in place.',
        ar ? 'للربط مجددًا، افتح GRINDCTRL في Shopify واختر المطالبة بهذا المتجر، أو استخدم رمز الربط من لوحة التحكم.' : 'To reconnect, open GRINDCTRL in Shopify and choose Claim this store, or use a dashboard link code.'],
      action: ar ? 'أعد ربط المتجر' : 'Reconnect your store', href: `https://grindctrl.cloud/dashboard/try-on/setup?shop=${encodeURIComponent(input.address)}#shopify-app`,
      footer: ar ? 'تصلك هذه الرسالة عند فصل المتجر.' : 'You get this email when the store is disconnected.', manageAlerts: false },
  };
  const address = input.address.replace(/[\u202a-\u202e\u2066-\u2069\r\n]/g, '').slice(0, 253);
  return buildStoreHealthEmail({ problem: 'code_gone', recovery: false, storeName: input.storeName,
    address: input.address, locale: input.locale, sinceDay: '' }, { ...messages[input.event], subject: `${messages[input.event].subject}: ${address}`, body: [address, ...messages[input.event].body] });
}
