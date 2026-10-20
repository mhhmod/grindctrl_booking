/* Copy for the v16 try-on sheet (02-try-on.md, copy/try-on.json).

   English follows the boards. Arabic comes in the three forms a store can
   choose for addressing its shoppers (01-system.md, contract N26's
   `addressForm`): women, men or everyone. The boards' drafts are the
   feminine forms; the masculine and neutral forms are written here, and
   neutral is the default until a store chooses, so a shopper is never
   addressed in a form the store did not pick. Every Arabic string here is
   a draft except "إغلاق", "صورتكِ" and "إطلالتكِ جاهزة", which the boards
   approve (the neutral "صورتك" drops only the vowel mark). */

import type { TryOnLocale } from './i18n';

export type ArabicAddressForm = 'women' | 'men' | 'everyone';

export const DEFAULT_ADDRESS_FORM: ArabicAddressForm = 'everyone';

export function isArabicAddressForm(value: unknown): value is ArabicAddressForm {
  return value === 'women' || value === 'men' || value === 'everyone';
}

export type SheetCopy = {
  close: string;
  back: string;
  /** "Black · M" under the product name. */
  variantLine: (variant: string) => string;
  photoTitle: string;
  photoIntro: string;
  /** Only with a measured time; without one the sentence is left out. */
  photoTime: (seconds: number) => string;
  tipFullLength: string;
  tipHijab: string;
  tipLight: string;
  takePhoto: string;
  takePhotoHint: string;
  choosePhoto: string;
  choosePhotoHint: string;
  lockLine: string;
  howPhotosHandled: string;
  privacyTitle: string;
  privacyBody: string[];
  yourPhoto: string;
  yourPhotoAlt: string;
  looksGreat: string;
  checkBrightSharp: string;
  checkLight: string;
  checkSharp: string;
  fixDark: string;
  fixBright: string;
  fixBlurry: string;
  whyItMatters: string;
  nothingSent: string;
  takeAgain: string;
  useAnyway: string;
  useDifferent: string;
  consentTitle: string;
  consentService: string;
  consentRetention: string;
  keepOnPhone: string;
  keepOnPhoneHint: string;
  agreeAndTry: string;
  tryItOn: string;
  agreeNote: string;
  privacyNoticeLink: string;
  checking: string;
  makingTitle: string;
  /** Only while the estimate lasts; never zero or less. */
  secondsLeft: (seconds: number) => string;
  /** The default steps, used when the store wrote none of its own. */
  makingSteps: string[];
  lookReady: string;
};

const EN: SheetCopy = {
  close: 'Close',
  back: 'Back to photo options',
  variantLine: (variant) => variant,
  photoTitle: 'See it on you',
  photoIntro: 'Add one photo where you stand straight, head to feet.',
  photoTime: (seconds) => `It takes about ${seconds} seconds.`,
  tipFullLength: 'Head to feet in frame',
  tipHijab: 'Hijab and loose clothes are fine',
  tipLight: 'Good light, plain wall',
  takePhoto: 'Take a photo',
  takePhotoHint: 'Use your camera now',
  choosePhoto: 'Choose from your photos',
  choosePhotoHint: 'iPhone and Android photos work',
  lockLine: 'Your photo is used only to make this preview. It is not stored permanently or shared publicly.',
  howPhotosHandled: 'How photos are handled',
  privacyTitle: 'How photos are handled',
  privacyBody: [
    'Your photo goes to our secure AI service only to make this preview, and it is not stored permanently or shared publicly.',
    'If you keep your photo on this phone, it stays here for 24 hours so you can try other pieces, then it is removed. Turn it off and nothing is saved on this phone.',
    'The store sees a look only if you send it to them.',
  ],
  yourPhoto: 'Your photo',
  yourPhotoAlt: 'Your photo',
  looksGreat: 'Looks great',
  checkBrightSharp: 'Bright and sharp',
  checkLight: 'Bright enough',
  checkSharp: 'Sharp',
  fixDark: 'Find more light, facing a window if you can',
  fixBright: 'Step out of the direct light so the photo is not washed out',
  fixBlurry: 'Hold the phone still so the photo is sharp',
  whyItMatters: 'A clear photo helps us get the fit and the fall of the piece right.',
  nothingSent: 'Nothing has been sent yet.',
  takeAgain: 'Take it again',
  useAnyway: 'Use this photo anyway',
  useDifferent: 'Use a different photo',
  consentTitle: 'Before your first try-on',
  consentService: 'Your photo goes to our secure AI service only to make this preview.',
  consentRetention: 'It is not stored permanently or shared publicly. We only ask this once.',
  keepOnPhone: 'Keep my photo on this phone',
  keepOnPhoneHint: 'Try other pieces in one tap. Kept on this phone for 24 hours.',
  agreeAndTry: 'Agree and try it on',
  tryItOn: 'Try it on',
  agreeNote: 'By continuing you agree to the',
  privacyNoticeLink: 'try-on privacy notice',
  checking: 'Checking your photo',
  makingTitle: 'Making your look',
  secondsLeft: (seconds) => `About ${seconds} ${seconds === 1 ? 'second' : 'seconds'} left`,
  makingSteps: ['Reading your photo', 'Fitting the garment', 'Rendering your look'],
  lookReady: 'Your look is ready',
};

/* Shared by every Arabic form: no second-person verb or pronoun. */
const AR_COMMON = {
  close: 'إغلاق',
  back: 'العودة إلى خيارات الصورة',
  variantLine: (variant: string) => variant,
  tipFullLength: 'من الرأس إلى القدمين داخل الصورة',
  tipHijab: 'الحجاب والملابس الواسعة لا مشكلة فيها',
  tipLight: 'إضاءة جيدة وحائط سادة',
  // 3 to 10 take the plural (ثوانٍ), 11 and up the singular (ثانية).
  photoTime: (seconds: number) => `يستغرق الأمر حوالي ${seconds} ${seconds <= 10 ? 'ثوانٍ' : 'ثانية'}.`,
  howPhotosHandled: 'كيف نتعامل مع الصور',
  privacyTitle: 'كيف نتعامل مع الصور',
  looksGreat: 'تبدو رائعة',
  checkBrightSharp: 'مضيئة وواضحة',
  checkLight: 'إضاءة كافية',
  checkSharp: 'واضحة',
  whyItMatters: 'الصورة الواضحة تساعدنا على إظهار المقاس وانسدال القطعة بشكل صحيح.',
  nothingSent: 'لم يُرسل أي شيء بعد.',
  consentRetention: 'لا تُحفظ بشكل دائم ولا تُنشر للعامة.',
  checking: 'جارٍ فحص الصورة',
  // 1 and 2 have their own words, 3 to 10 the plural, 11 and up the singular.
  secondsLeft: (seconds: number) =>
    seconds === 1
      ? 'تبقّت ثانية واحدة تقريباً'
      : seconds === 2
        ? 'تبقّت ثانيتان تقريباً'
        : `تبقّت ${seconds} ${seconds <= 10 ? 'ثوانٍ' : 'ثانية'} تقريباً`,
} as const;

const AR: Record<ArabicAddressForm, SheetCopy> = {
  women: {
    ...AR_COMMON,
    photoTitle: 'شاهديها عليكِ',
    photoIntro: 'أضيفي صورة واحدة وأنتِ واقفة باستقامة، من الرأس إلى القدمين.',
    takePhoto: 'التقطي صورة',
    takePhotoHint: 'استخدمي الكاميرا الآن',
    choosePhoto: 'اختاري من صوركِ',
    choosePhotoHint: 'صور iPhone وAndroid مناسبة',
    lockLine: 'تُستخدم صورتكِ فقط لتجهيز هذه المعاينة. لا تُحفظ بشكل دائم ولا تُنشر للعامة.',
    privacyBody: [
      'تُرسل صورتكِ إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة، ولا تُحفظ بشكل دائم ولا تُنشر للعامة.',
      'إذا احتفظتِ بصورتكِ على هذا الهاتف، تبقى عليه 24 ساعة لتجربي قطعاً أخرى، ثم تُحذف. وإذا أوقفتِ ذلك فلن يُحفظ شيء على الهاتف.',
      'لا يرى المتجر الإطلالة إلا إذا أرسلتِها إليه.',
    ],
    yourPhoto: 'صورتكِ',
    yourPhotoAlt: 'صورتكِ',
    fixDark: 'ابحثي عن إضاءة أكثر، ويُفضّل أن تكوني مقابل نافذة',
    fixBright: 'ابتعدي عن الضوء المباشر حتى لا تبدو الصورة باهتة',
    fixBlurry: 'ثبّتي الهاتف حتى تكون الصورة واضحة',
    takeAgain: 'التقطيها مرة أخرى',
    useAnyway: 'استخدمي هذه الصورة على أي حال',
    useDifferent: 'استخدمي صورة أخرى',
    consentTitle: 'قبل تجربتكِ الأولى',
    consentService: 'تُرسل صورتكِ إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة.',
    consentRetention: 'لا تُحفظ بشكل دائم ولا تُنشر للعامة. نسألكِ هذا مرة واحدة فقط.',
    keepOnPhone: 'الاحتفاظ بصورتي على هذا الهاتف',
    keepOnPhoneHint: 'جربي قطعاً أخرى بلمسة واحدة. تبقى على هذا الهاتف 24 ساعة.',
    agreeAndTry: 'وافقي وجربيها عليكِ',
    tryItOn: 'جربيها عليكِ',
    agreeNote: 'بالمتابعة توافقين على',
    privacyNoticeLink: 'إشعار الخصوصية الخاص بالتجربة الافتراضية',
    makingTitle: 'نجهّز إطلالتكِ',
    makingSteps: ['نحلّل صورتكِ', 'نضبط القطعة عليكِ', 'نضع اللمسات الأخيرة على إطلالتكِ'],
    lookReady: 'إطلالتكِ جاهزة',
  },
  men: {
    ...AR_COMMON,
    photoTitle: 'شاهدها عليك',
    photoIntro: 'أضف صورة واحدة وأنت واقف باستقامة، من الرأس إلى القدمين.',
    takePhoto: 'التقط صورة',
    takePhotoHint: 'استخدم الكاميرا الآن',
    choosePhoto: 'اختر من صورك',
    choosePhotoHint: 'صور iPhone وAndroid مناسبة',
    lockLine: 'تُستخدم صورتك فقط لتجهيز هذه المعاينة. لا تُحفظ بشكل دائم ولا تُنشر للعامة.',
    privacyBody: [
      'تُرسل صورتك إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة، ولا تُحفظ بشكل دائم ولا تُنشر للعامة.',
      'إذا احتفظت بصورتك على هذا الهاتف، تبقى عليه 24 ساعة لتجرب قطعاً أخرى، ثم تُحذف. وإذا أوقفت ذلك فلن يُحفظ شيء على الهاتف.',
      'لا يرى المتجر الإطلالة إلا إذا أرسلتها إليه.',
    ],
    yourPhoto: 'صورتك',
    yourPhotoAlt: 'صورتك',
    fixDark: 'ابحث عن إضاءة أكثر، ويُفضّل أن تكون مقابل نافذة',
    fixBright: 'ابتعد عن الضوء المباشر حتى لا تبدو الصورة باهتة',
    fixBlurry: 'ثبّت الهاتف حتى تكون الصورة واضحة',
    takeAgain: 'التقطها مرة أخرى',
    useAnyway: 'استخدم هذه الصورة على أي حال',
    useDifferent: 'استخدم صورة أخرى',
    consentTitle: 'قبل تجربتك الأولى',
    consentService: 'تُرسل صورتك إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة.',
    consentRetention: 'لا تُحفظ بشكل دائم ولا تُنشر للعامة. نسألك هذا مرة واحدة فقط.',
    keepOnPhone: 'الاحتفاظ بصورتي على هذا الهاتف',
    keepOnPhoneHint: 'جرب قطعاً أخرى بلمسة واحدة. تبقى على هذا الهاتف 24 ساعة.',
    agreeAndTry: 'وافق وجربها عليك',
    tryItOn: 'جربها عليك',
    agreeNote: 'بالمتابعة توافق على',
    privacyNoticeLink: 'إشعار الخصوصية الخاص بالتجربة الافتراضية',
    makingTitle: 'نجهّز إطلالتك',
    makingSteps: ['نحلّل صورتك', 'نضبط القطعة عليك', 'نضع اللمسات الأخيرة على إطلالتك'],
    lookReady: 'إطلالتك جاهزة',
  },
  everyone: {
    ...AR_COMMON,
    photoTitle: 'القطعة عليك',
    photoIntro: 'صورة واحدة بوقفة مستقيمة، من الرأس إلى القدمين.',
    takePhoto: 'التقاط صورة',
    takePhotoHint: 'بالكاميرا الآن',
    choosePhoto: 'اختيار صورة من الهاتف',
    choosePhotoHint: 'صور iPhone وAndroid مناسبة',
    lockLine: 'تُستخدم الصورة فقط لتجهيز هذه المعاينة. لا تُحفظ بشكل دائم ولا تُنشر للعامة.',
    privacyBody: [
      'تُرسل الصورة إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة، ولا تُحفظ بشكل دائم ولا تُنشر للعامة.',
      'عند الاحتفاظ بالصورة على هذا الهاتف، تبقى عليه 24 ساعة لتجربة قطع أخرى، ثم تُحذف. وعند إيقاف ذلك لا يُحفظ شيء على الهاتف.',
      'لا يرى المتجر الإطلالة إلا عند إرسالها إليه.',
    ],
    yourPhoto: 'صورتك',
    yourPhotoAlt: 'الصورة',
    fixDark: 'إضاءة أكثر تساعد، ويُفضّل الوقوف مقابل نافذة',
    fixBright: 'الابتعاد عن الضوء المباشر يمنع أن تبدو الصورة باهتة',
    fixBlurry: 'تثبيت الهاتف يجعل الصورة أوضح',
    takeAgain: 'التقاطها مرة أخرى',
    useAnyway: 'استخدام هذه الصورة على أي حال',
    useDifferent: 'استخدام صورة أخرى',
    consentTitle: 'قبل التجربة الأولى',
    consentService: 'تُرسل الصورة إلى خدمة الذكاء الاصطناعي الآمنة لدينا فقط لتجهيز هذه المعاينة.',
    consentRetention: 'لا تُحفظ بشكل دائم ولا تُنشر للعامة. هذا السؤال مرة واحدة فقط.',
    keepOnPhone: 'الاحتفاظ بالصورة على هذا الهاتف',
    keepOnPhoneHint: 'تجربة قطع أخرى بلمسة واحدة. تبقى على هذا الهاتف 24 ساعة.',
    agreeAndTry: 'موافقة وتجربة القطعة',
    tryItOn: 'تجربة القطعة',
    agreeNote: 'المتابعة تعني الموافقة على',
    privacyNoticeLink: 'إشعار الخصوصية الخاص بالتجربة الافتراضية',
    makingTitle: 'نجهّز الإطلالة',
    makingSteps: ['نحلّل الصورة', 'نضبط القطعة', 'نضع اللمسات الأخيرة على الإطلالة'],
    lookReady: 'الإطلالة جاهزة',
  },
};

export function getSheetCopy(locale: TryOnLocale, addressForm: ArabicAddressForm = DEFAULT_ADDRESS_FORM): SheetCopy {
  return locale === 'ar' ? AR[addressForm] : EN;
}
