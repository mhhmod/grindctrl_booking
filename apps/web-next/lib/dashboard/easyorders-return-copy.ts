/* Copy for the page EasyOrders sends the merchant back to after approving the
   app (app/dashboard/store-chat/easyorders/return). Drafts. Western digits. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { EasyOrdersInstallResult } from '@/lib/easyorders/types';

type Notice = { title: string; body: string };
export interface EasyOrdersReturnCopy {
  confirm: (store: string) => Notice;
  awaiting: Notice;
  providerUnavailable: Notice;
  rateLimited: (seconds: number) => Notice;
  active: (store: string) => Notice;
  expired: Notice;
  failed: Record<Extract<EasyOrdersInstallResult, { status: 'failed' }>['reason'], Notice>;
  actions: { connect: string; cancel: string; checkAgain: string; tryAgain: string; openStoreChat: string; backToStoreChat: string };
}

const en: EasyOrdersReturnCopy = {
  confirm: (store) => ({
    title: 'Connect this EasyOrders store?',
    body: `EasyOrders approved store ${store}. Connect it only if it is your store. Store Chat will then answer order questions and learn your products from it.`,
  }),
  awaiting: { title: 'Waiting for EasyOrders', body: 'EasyOrders has not sent the store details yet. This usually takes a few seconds.' },
  providerUnavailable: { title: 'Could not reach EasyOrders', body: 'Nothing is connected yet. Try again in a moment.' },
  rateLimited: (seconds) => ({ title: 'EasyOrders asked us to wait', body: `Nothing is connected yet. Try again in ${seconds} seconds.` }),
  active: (store) => ({ title: `Connected to ${store}`, body: 'Store Chat can now answer order questions. Your products are being added to what it knows.' }),
  expired: { title: 'This link expired', body: 'Nothing was connected. Create a new EasyOrders link from Store Chat.' },
  failed: {
    signed_out: { title: 'Sign in to finish', body: 'Sign in with the account that created this link, then open it again.' },
    wrong_account: { title: 'This link belongs to another account', body: 'Nothing was connected and the store details were discarded. Ask the person who created the link to connect from their own account.' },
    forbidden: { title: 'You cannot connect stores here', body: 'Only the store owner can connect EasyOrders. Nothing was connected.' },
    invalid_link: { title: 'This link can no longer be used', body: 'It was replaced by a newer link or already used. Create a new link from Store Chat.' },
    cancelled: { title: 'Not connected', body: 'This link was cancelled or opened by another account. Create a new link from Store Chat to try again.' },
    provider_rejected: { title: 'EasyOrders did not accept the connection', body: 'The store key was refused, so nothing was connected. Create a new link from Store Chat.' },
    store_already_connected: { title: 'This store is already connected', body: 'That EasyOrders store is connected to another site. Disconnect it there first.' },
    rate_limited: { title: 'Too many attempts', body: 'Wait a moment, then try again.' },
    unavailable: { title: 'Something went wrong', body: 'Nothing was connected. Try again in a moment.' },
  },
  actions: {
    connect: 'Connect store', cancel: 'Cancel', checkAgain: 'Check again', tryAgain: 'Try again',
    openStoreChat: 'Open Store Chat', backToStoreChat: 'Back to Store Chat',
  },
};

const ar: EasyOrdersReturnCopy = {
  confirm: (store) => ({
    title: 'ربط متجر EasyOrders هذا؟',
    body: `وافقت EasyOrders على المتجر ${store}. اربطه فقط إن كان متجرك. بعدها يجيب Store Chat عن أسئلة الطلبات ويتعرّف على منتجاتك منه.`,
  }),
  awaiting: { title: 'بانتظار EasyOrders', body: 'لم ترسل EasyOrders بيانات المتجر بعد. يستغرق ذلك عادة بضع ثوانٍ.' },
  providerUnavailable: { title: 'تعذّر الوصول إلى EasyOrders', body: 'لم يُربط أي شيء بعد. حاول مرة أخرى بعد قليل.' },
  rateLimited: (seconds) => ({ title: 'طلبت EasyOrders الانتظار', body: `لم يُربط أي شيء بعد. حاول مرة أخرى بعد ${seconds} ثانية.` }),
  active: (store) => ({ title: `تم الربط مع ${store}`, body: 'يستطيع Store Chat الآن الإجابة عن أسئلة الطلبات. تتم إضافة منتجاتك إلى ما يعرفه.' }),
  expired: { title: 'انتهت صلاحية هذا الرابط', body: 'لم يُربط أي شيء. أنشئ رابط EasyOrders جديداً من Store Chat.' },
  failed: {
    signed_out: { title: 'سجّل الدخول للإكمال', body: 'سجّل الدخول بالحساب الذي أنشأ هذا الرابط، ثم افتحه مرة أخرى.' },
    wrong_account: { title: 'هذا الرابط يخص حساباً آخر', body: 'لم يُربط أي شيء وتم حذف بيانات المتجر. اطلب من منشئ الرابط الربط من حسابه.' },
    forbidden: { title: 'لا يمكنك ربط المتاجر هنا', body: 'مالك المتجر فقط يستطيع ربط EasyOrders. لم يُربط أي شيء.' },
    invalid_link: { title: 'لم يعد هذا الرابط صالحاً', body: 'تم استبداله برابط أحدث أو استُخدم من قبل. أنشئ رابطاً جديداً من Store Chat.' },
    cancelled: { title: 'لم يتم الربط', body: 'أُلغي هذا الرابط أو فُتح من حساب آخر. أنشئ رابطاً جديداً من Store Chat للمحاولة مجدداً.' },
    provider_rejected: { title: 'لم تقبل EasyOrders الربط', body: 'رُفض مفتاح المتجر، لذلك لم يُربط أي شيء. أنشئ رابطاً جديداً من Store Chat.' },
    store_already_connected: { title: 'هذا المتجر مربوط بالفعل', body: 'متجر EasyOrders هذا مربوط بموقع آخر. افصله من هناك أولاً.' },
    rate_limited: { title: 'محاولات كثيرة', body: 'انتظر قليلاً ثم حاول مرة أخرى.' },
    unavailable: { title: 'حدث خطأ ما', body: 'لم يُربط أي شيء. حاول مرة أخرى بعد قليل.' },
  },
  actions: {
    connect: 'ربط المتجر', cancel: 'إلغاء', checkAgain: 'تحقق مرة أخرى', tryAgain: 'حاول مرة أخرى',
    openStoreChat: 'فتح Store Chat', backToStoreChat: 'العودة إلى Store Chat',
  },
};

export function getEasyOrdersReturnCopy(locale: SiteLocale): EasyOrdersReturnCopy {
  return locale === 'ar' ? ar : en;
}
