/* Copy for the auth and onboarding surfaces, in the two locales the rest of
   the site speaks. Kept separate from the landing dictionary because these
   pages are small and share none of its strings, but it reads the SAME
   locale cookie so a language picked on the landing page carries through
   sign-in and onboarding. */

import { SITE_LOCALE_COOKIE, type SiteLocale } from '@/lib/landing/landing-i18n';

export { SITE_LOCALE_COOKIE };
export type { SiteLocale };

export interface AuthCopy {
  brandHeadline: string;
  brandBody: string;
  brandTagline: string;
  signInTitle: string;
  signInSubtitle: string;
  /** Shown instead of signInTitle/Subtitle when arriving via the Shopify
   *  claim redirect — that visitor may never have had an account, so
   *  "Welcome back" is the wrong tone regardless of locale. */
  claimSignInTitle: string;
  claimSignInSubtitle: string;
  signInFooterPrompt: string;
  signInFooterCta: string;
  signUpTitle: string;
  signUpSubtitle: string;
  signUpFooterPrompt: string;
  signUpFooterCta: string;
  /** Shown on sign-in after signing out, so the person knows it worked. */
  signedOutNotice: string;
  /** Screen-reader name of the placeholder shown while the form loads. */
  formLoading: string;
  formSlowTitle: string;
  formSlowBody: string;
  formFailedTitle: string;
  formFailedBody: string;
  retry: string;
  contactSupport: string;
  /** Production with no auth configured: non-technical, no env names. */
  unavailableTitle: string;
  unavailableBody: string;
  onboardingTitle: string;
  onboardingLead: string;
  fieldName: string;
  fieldPhone: string;
  fieldPhoneHint: string;
  fieldCompany: string;
  fieldWebsite: string;
  fieldWebsiteHint: string;
  fieldPlatform: string;
  fieldOrders: string;
  fieldGoal: string;
  fieldGoalHint: string;
  selectPlaceholder: string;
  submit: string;
  submitting: string;
  platforms: string[];
  orderRanges: string[];
  errorName: string;
  errorPhone: string;
  errorWebsite: string;
  errorCompany: string;
  errorPlatform: string;
  errorOrders: string;
  errorNoEmail: string;
  errorNoStorage: string;
  errorSaveFailed: string;
}

const en: AuthCopy = {
  brandHeadline: 'We build, run, and maintain your AI.',
  brandBody: 'You watch every workflow, lead, and conversation from one dashboard.',
  brandTagline: 'Done-for-you AI automation, watched from one dashboard.',
  signInTitle: 'Welcome back',
  signInSubtitle:
    'Sign in to see your automations, leads, and conversations in one dashboard.',
  claimSignInTitle: 'One more step to connect your store',
  claimSignInSubtitle: 'Sign in or create an account to finish linking your Shopify store.',
  signInFooterPrompt: 'Need an account?',
  signInFooterCta: 'Create one',
  signUpTitle: 'Create your account',
  signUpSubtitle: 'Set up your store once, then run try-on and the rest from one dashboard.',
  signUpFooterPrompt: 'Already have an account?',
  signUpFooterCta: 'Sign in',
  signedOutNotice: 'You’re signed out.',
  formLoading: 'Loading the form',
  formSlowTitle: 'This is taking longer than usual',
  formSlowBody: 'Check your connection and try again. If it keeps happening, contact support.',
  formFailedTitle: 'The form didn’t load',
  formFailedBody: 'Something stopped it from loading. Try again, or contact support if it keeps happening.',
  retry: 'Try again',
  contactSupport: 'Contact support',
  unavailableTitle: 'Signing in isn’t available right now',
  unavailableBody: 'We’re working on it. Try again in a few minutes, or contact support.',
  onboardingTitle: 'Tell us about your store',
  onboardingLead:
    'Six quick answers. We use them to set up your account and to prepare before we speak, so nothing on the call is a blank page.',
  fieldName: 'Your name',
  fieldPhone: 'Phone number',
  fieldPhoneHint: 'Include the country code so we can reach you on WhatsApp.',
  fieldCompany: 'Store or company name',
  fieldWebsite: 'Store website',
  fieldWebsiteHint: 'We look at your product pages before the call.',
  fieldPlatform: 'Where does your store run?',
  fieldOrders: 'Roughly how many orders a month?',
  fieldGoal: 'What do you want AI to fix first?',
  fieldGoalHint: 'Optional. One line is enough.',
  selectPlaceholder: 'Select an option',
  submit: 'Go to my dashboard',
  submitting: 'Saving...',
  platforms: ['Shopify', 'WooCommerce', 'Salla', 'Zid', 'Custom build', 'Not live yet'],
  orderRanges: [
    'Under 100 a month',
    '100 to 500 a month',
    '500 to 2000 a month',
    'Over 2000 a month',
  ],
  errorName: 'Enter your full name.',
  errorPhone: 'Enter a valid phone number, including the country code.',
  errorWebsite: 'Enter a valid store or website address.',
  errorCompany: 'Enter your store or company name.',
  errorPlatform: 'Pick where your store runs.',
  errorOrders: 'Pick a monthly order range.',
  errorNoEmail: 'No email on your account. Contact support.',
  errorNoStorage: 'Storage is not configured. Contact support.',
  errorSaveFailed: 'Could not save your details. Try again.',
};

const ar: AuthCopy = {
  brandHeadline: 'نبني ونشغّل ونتابع الذكاء الاصطناعي الخاص بك.',
  brandBody: 'وتتابع أنت كل عملية وعميل ومحادثة من لوحة واحدة.',
  brandTagline: 'أتمتة ذكاء اصطناعي مجهزة بالكامل، تتابعها من لوحة واحدة.',
  signInTitle: 'أهلًا بعودتك',
  signInSubtitle: 'سجّل الدخول لمتابعة الأتمتة والعملاء والمحادثات من لوحة واحدة.',
  claimSignInTitle: 'خطوة أخيرة لربط متجرك',
  claimSignInSubtitle: 'سجّل الدخول أو أنشئ حساباً لإتمام ربط متجرك على Shopify.',
  signInFooterPrompt: 'ليس لديك حساب؟',
  signInFooterCta: 'أنشئ حسابًا',
  signUpTitle: 'أنشئ حسابك',
  signUpSubtitle: 'جهّز متجرك مرة واحدة، ثم شغّل التجربة الافتراضية وغيرها من لوحة واحدة.',
  signUpFooterPrompt: 'لديك حساب بالفعل؟',
  signUpFooterCta: 'سجّل الدخول',
  signedOutNotice: 'تم تسجيل خروجك.',
  formLoading: 'جارٍ تحميل النموذج',
  formSlowTitle: 'يستغرق هذا وقتًا أطول من المعتاد',
  formSlowBody: 'تحقّق من اتصالك وحاول مرة أخرى. إذا تكرر ذلك، تواصل مع الدعم.',
  formFailedTitle: 'لم يتم تحميل النموذج',
  formFailedBody: 'حدث ما منع تحميله. حاول مرة أخرى، أو تواصل مع الدعم إذا تكرر ذلك.',
  retry: 'أعد المحاولة',
  contactSupport: 'تواصل مع الدعم',
  unavailableTitle: 'تسجيل الدخول غير متاح الآن',
  unavailableBody: 'نعمل على حل المشكلة. حاول مرة أخرى بعد دقائق، أو تواصل مع الدعم.',
  onboardingTitle: 'عرّفنا على متجرك',
  onboardingLead:
    'ست إجابات سريعة. نستخدمها لتجهيز حسابك وللتحضير قبل التحدث معك، حتى لا نبدأ المكالمة من صفحة فارغة.',
  fieldName: 'اسمك',
  fieldPhone: 'رقم الهاتف',
  fieldPhoneHint: 'أضف رمز الدولة حتى نتمكن من التواصل معك على واتساب.',
  fieldCompany: 'اسم المتجر أو الشركة',
  fieldWebsite: 'موقع المتجر',
  fieldWebsiteHint: 'نطّلع على صفحات منتجاتك قبل المكالمة.',
  fieldPlatform: 'أين يعمل متجرك؟',
  fieldOrders: 'كم عدد الطلبات شهريًا تقريبًا؟',
  fieldGoal: 'ما الذي تريد من الذكاء الاصطناعي معالجته أولًا؟',
  fieldGoalHint: 'اختياري. سطر واحد يكفي.',
  selectPlaceholder: 'اختر من القائمة',
  submit: 'انتقل إلى لوحتي',
  submitting: 'جارٍ الحفظ...',
  platforms: ['Shopify', 'WooCommerce', 'سلة', 'زد', 'تطوير مخصص', 'لم يُطلق بعد'],
  orderRanges: [
    'أقل من 100 شهريًا',
    'من 100 إلى 500 شهريًا',
    'من 500 إلى 2000 شهريًا',
    'أكثر من 2000 شهريًا',
  ],
  errorName: 'أدخل اسمك الكامل.',
  errorPhone: 'أدخل رقم هاتف صحيحًا مع رمز الدولة.',
  errorWebsite: 'أدخل عنوان متجر أو موقع صحيحًا.',
  errorCompany: 'أدخل اسم متجرك أو شركتك.',
  errorPlatform: 'اختر أين يعمل متجرك.',
  errorOrders: 'اختر عدد الطلبات الشهري.',
  errorNoEmail: 'لا يوجد بريد إلكتروني على حسابك. تواصل مع الدعم.',
  errorNoStorage: 'التخزين غير مهيأ. تواصل مع الدعم.',
  errorSaveFailed: 'تعذّر حفظ بياناتك. حاول مرة أخرى.',
};

/** The support inbox already used on the claim and store pages. */
export const AUTH_SUPPORT_HREF = 'mailto:grindctrlnow@gmail.com';

/** What the client-side form states need, so the whole dictionary is not
 *  serialized into the page. */
export type AuthFormStateCopy = Pick<
  AuthCopy,
  'formLoading' | 'formSlowTitle' | 'formSlowBody' | 'formFailedTitle' | 'formFailedBody' | 'retry' | 'contactSupport'
>;

export function authFormStateCopy(copy: AuthCopy): AuthFormStateCopy {
  const { formLoading, formSlowTitle, formSlowBody, formFailedTitle, formFailedBody, retry, contactSupport } = copy;
  return { formLoading, formSlowTitle, formSlowBody, formFailedTitle, formFailedBody, retry, contactSupport };
}

export function getAuthCopy(locale: SiteLocale): AuthCopy {
  return locale === 'ar' ? ar : en;
}
