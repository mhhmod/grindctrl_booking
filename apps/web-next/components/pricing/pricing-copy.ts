import type { SiteIconName } from '@/components/site/icons';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export type PlanFeature = {
  icon: SiteIconName;
  text: string;
  /** Hidden until this lib/product-truth record is publishable. */
  truthRecordId?: string;
};

type PlanCopy = {
  name: string;
  description: string;
  features: PlanFeature[];
  /** Overrides the bookCallForPlan template where the approved wording differs. */
  button?: string;
};

type PackCopy = {
  name: string;
};

export type PricingFaqItem = {
  icon: SiteIconName;
  question: string;
  answer: string;
  truthRecordId?: string;
};

export type PricingCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  bookCall: string;
  tryDemo: string;
  pricing: string;
  onThisPage: string;
  tabPlans: string;
  tabTopups: string;
  tabQuestions: string;
  trace: string[];
  unitAria: string;
  unitPhoto: string;
  unitPiece: string;
  unitLook: string;
  unitTryOn: string;
  unitDelivered: string;
  marketLabel: string;
  marketLead: string;
  plansEyebrow: string;
  plansTitle: string;
  recommended: string;
  month: string;
  tryOns: (count: string) => string;
  perMonth: string;
  standardQuality: string;
  premiumQuality: string;
  choosePlan: (name: string) => string;
  bookCallForPlan: (name: string) => string;
  plans: Record<string, PlanCopy>;
  creditsAria: string;
  creditsTitle: string;
  creditsLine: string;
  creditReserved: string;
  creditReservedWhen: string;
  creditDelivered: string;
  creditDeliveredResult: string;
  creditFailed: string;
  creditFailedResult: string;
  creditNote: string;
  packsEyebrow: string;
  packsTitle: string;
  packsBody: string;
  oneTime: string;
  renders: (count: string) => string;
  validFor: (days: string) => string;
  premium: string;
  packs: Record<string, PackCopy>;
  askAboutPack: (name: string) => string;
  faqEyebrow: string;
  faqTitle: string;
  termsReviewNote: string;
  faq: PricingFaqItem[];
  ctaTitle: string;
  ctaBody: string;
};

const MANAGED_SETUP = 'service.managed-setup';

const en: PricingCopy = {
  eyebrow: 'AI Try-On pricing',
  title: 'More shopper confidence, priced for real usage.',
  intro: 'Start free, move up when try-on becomes part of your store.',
  bookCall: 'Book a pricing call',
  tryDemo: 'Try the live demo',
  pricing: 'Pricing',
  onThisPage: 'On this page',
  tabPlans: 'Plans',
  tabTopups: 'Top-ups',
  tabQuestions: 'Questions',
  trace: ['plan chosen', 'credits loaded', 'image delivered', 'credit used'],
  unitAria: 'One try-on: a shopper photo and a piece make one delivered look. One look uses one credit.',
  unitPhoto: 'Photo',
  unitPiece: 'Piece',
  unitLook: 'Look',
  unitTryOn: '1 try-on',
  unitDelivered: '1 delivered image',
  marketLabel: 'Market position',
  marketLead: 'Entry plans from other Shopify try-on apps typically include 100 to 150 try-ons a month.',
  plansEyebrow: 'Monthly plans',
  plansTitle: 'Pick the level of support your store needs.',
  recommended: 'Recommended',
  month: 'month',
  tryOns: (count) => `${count} try-ons`,
  perMonth: 'per month',
  standardQuality: 'Standard image quality',
  premiumQuality: 'Premium image quality',
  choosePlan: (name) => `Choose ${name}`,
  bookCallForPlan: (name) => `Book a call about ${name}`,
  plans: {
    'free-v1': {
      name: 'Free',
      description: 'Start with the live storefront experience.',
      features: [
        { icon: 'card', text: 'No card required' },
        { icon: 'bag', text: 'A simple starting point for one store' },
      ],
    },
    'launch-v1': {
      name: 'Launch',
      description: 'The best value for stores ready to make try-on part of the buying journey.',
      features: [
        { icon: 'bolt', text: 'Our best value for a growing store' },
        { icon: 'stack', text: 'Top-ups may be available; confirm during booking' },
      ],
      button: 'Book a call about Launch',
    },
    'growth-v1': {
      name: 'Growth',
      description: 'For stores past their first month.',
      features: [],
      button: 'Book a call about Growth',
    },
    'pro-v1': {
      name: 'Pro',
      description: 'Growth plan plus done-for-you setup.',
      features: [{ icon: 'handoff', text: 'Done-for-you setup', truthRecordId: MANAGED_SETUP }],
      button: 'Book a call about Pro',
    },
    'dfy-v1': {
      name: 'Done-for-you',
      description: 'Premium output with service scope confirmed before activation.',
      features: [
        { icon: 'check', text: 'Implementation scope confirmed during booking' },
        { icon: 'check', text: 'Brand options reviewed before activation' },
      ],
    },
  },
  creditsAria: 'Plan credits are charged for delivered images. A failed generation returns the reserved credit.',
  creditsTitle: 'How credits work',
  creditsLine: 'Plan credits are charged for delivered images.',
  creditReserved: 'Credit reserved',
  creditReservedWhen: 'When a shopper presses Generate',
  creditDelivered: 'Image delivered',
  creditDeliveredResult: 'The credit is used',
  creditFailed: 'Generation failed',
  creditFailedResult: 'The credit comes back',
  creditNote: 'Upstream provider cost may still be incurred on a failed generation.',
  packsEyebrow: 'Top-up packs',
  packsTitle: 'Add credits without changing your plan.',
  packsBody: 'Ask us to confirm current pack availability and terms before activation.',
  oneTime: 'one time',
  renders: (count) => `${count} renders`,
  validFor: (days) => `Valid for ${days} days`,
  premium: 'Premium',
  packs: {
    'pack-lite-v1': { name: 'Boost 80' },
    'pack-flash-v1': { name: 'Boost 75 Pro' },
  },
  askAboutPack: (name) => `Ask about ${name}`,
  faqEyebrow: 'Questions',
  faqTitle: 'Straight answers before you start.',
  termsReviewNote: 'Payment, activation, renewal, and contract terms are confirmed during booking.',
  faq: [
    {
      icon: 'stack',
      question: 'What happens when I run out of credits?',
      answer:
        'The try-on widget stops showing to shoppers, so your store never displays a broken button. Top up your credits or upgrade your plan to bring it back.',
    },
    {
      icon: 'clock',
      question: 'Do unused credits roll over?',
      answer:
        'Plan credits reset at the end of each billing period. Top-up credits last for 365 days and can carry across active plan periods.',
      truthRecordId: 'pricing.topups-valid-365-days',
    },
    {
      icon: 'card',
      question: 'How do I pay?',
      answer:
        'No card is needed right now. Pay by bank transfer, Instapay, or Vodafone Cash, and we activate your plan the same day.',
      truthRecordId: 'pricing.manual-payment-same-day-activation',
    },
    {
      icon: 'refund',
      question: 'What happens if a generation fails?',
      answer:
        'The credit is refunded automatically. You only pay for images that are delivered successfully.',
    },
    {
      icon: 'swap',
      question: 'Can I change plans?',
      answer:
        'Yes. Upgrades apply immediately. Downgrades take effect at the start of your next billing period.',
    },
    {
      icon: 'note',
      question: 'Is there a contract?',
      answer: 'No. Plans are month to month, with no long-term contract.',
      truthRecordId: 'pricing.month-to-month-no-contract',
    },
  ],
  ctaTitle: 'Want try-on to feel native to your store?',
  ctaBody: 'Book a short call. We will recommend the right plan and map the setup with you.',
};

const ar: PricingCopy = {
  eyebrow: 'أسعار تجربة الملابس بالذكاء الاصطناعي',
  title: 'ثقة أكبر للمتسوق، بسعر يناسب الاستخدام الحقيقي.',
  intro: 'ابدأ مجانًا، وانتقل إلى خطة أعلى عندما تصبح التجربة جزءًا من متجرك.',
  bookCall: 'احجز مكالمة للأسعار',
  tryDemo: 'جرّب النسخة المباشرة',
  pricing: 'الأسعار',
  onThisPage: 'في هذه الصفحة',
  tabPlans: 'الخطط',
  tabTopups: 'الرصيد الإضافي',
  tabQuestions: 'الأسئلة',
  trace: ['اختيرت الخطة', 'أُضيف الرصيد', 'سُلّمت الصورة', 'خُصم الرصيد'],
  unitAria: 'تجربة واحدة: صورة المتسوق مع القطعة تنتج إطلالة واحدة مُسلَّمة، وكل إطلالة تستخدم رصيدًا واحدًا.',
  unitPhoto: 'الصورة',
  unitPiece: 'القطعة',
  unitLook: 'الإطلالة',
  unitTryOn: 'تجربة واحدة',
  unitDelivered: 'صورة واحدة مُسلَّمة',
  marketLabel: 'موقعنا في السوق',
  marketLead: 'تتضمن الخطط الأساسية في تطبيقات تجربة الملابس الأخرى على Shopify من 100 إلى 150 تجربة شهريًا.',
  plansEyebrow: 'الخطط الشهرية',
  plansTitle: 'اختر مستوى الدعم المناسب لمتجرك.',
  recommended: 'موصى بها',
  month: 'شهر',
  tryOns: (count) => `${count} تجربة`,
  perMonth: 'شهريًا',
  standardQuality: 'جودة صور قياسية',
  premiumQuality: 'جودة صور مميزة',
  choosePlan: (name) => `اختر ${name}`,
  bookCallForPlan: (name) => `احجز مكالمة عن ${name}`,
  plans: {
    'free-v1': {
      name: 'مجاني',
      description: 'اختبر تجربة المتجر المباشرة قبل الالتزام.',
      features: [
        { icon: 'card', text: 'لا تحتاج إلى بطاقة' },
        { icon: 'bag', text: 'بداية بسيطة لمتجر واحد' },
      ],
    },
    'launch-v1': {
      name: 'انطلاق',
      description: 'أفضل قيمة للمتاجر الجاهزة لجعل التجربة جزءًا من رحلة الشراء.',
      features: [
        { icon: 'bolt', text: 'أفضل قيمة لمتجر في مرحلة النمو' },
        { icon: 'stack', text: 'قد تتوفر أرصدة إضافية؛ نؤكدها أثناء الحجز' },
      ],
      button: 'احجز مكالمة عن خطة انطلاق',
    },
    'growth-v1': {
      name: 'نمو',
      description: 'للمتاجر التي تجاوزت شهرها الأول.',
      features: [],
      button: 'احجز مكالمة عن خطة نمو',
    },
    'pro-v1': {
      name: 'احترافي',
      description: 'خطة النمو مع إعداد متكامل ننفّذه لك.',
      features: [{ icon: 'handoff', text: 'إعداد متكامل ننفّذه لك', truthRecordId: MANAGED_SETUP }],
      button: 'احجز مكالمة عن الخطة الاحترافية',
    },
    'dfy-v1': {
      name: 'خدمة متكاملة',
      description: 'صور مميزة مع تأكيد نطاق الخدمة قبل التفعيل.',
      features: [
        { icon: 'check', text: 'تأكيد نطاق التنفيذ أثناء الحجز' },
        { icon: 'check', text: 'مراجعة خيارات الهوية قبل التفعيل' },
      ],
    },
  },
  creditsAria: 'يُخصم رصيد الخطة مقابل الصور التي تم تسليمها، وتعيد العملية الفاشلة الرصيد المحجوز.',
  creditsTitle: 'كيف يعمل الرصيد',
  creditsLine: 'يُخصم رصيد الخطة مقابل الصور التي تم تسليمها.',
  creditReserved: 'حجز الرصيد',
  creditReservedWhen: 'عندما يضغط المتسوق على إنشاء',
  creditDelivered: 'تم تسليم الصورة',
  creditDeliveredResult: 'يُخصم الرصيد',
  creditFailed: 'فشلت عملية الإنشاء',
  creditFailedResult: 'يعود الرصيد',
  creditNote: 'قد تبقى تكلفة مزود الخدمة قائمة عند فشل عملية الإنشاء.',
  packsEyebrow: 'حزم الرصيد الإضافي',
  packsTitle: 'أضف رصيدًا دون تغيير خطتك.',
  packsBody: 'تواصل معنا لتأكيد توفر الحزم وشروطها الحالية قبل التفعيل.',
  oneTime: 'دفعة واحدة',
  renders: (count) => `${count} صورة`,
  validFor: (days) => `صالحة لمدة ${days} يومًا`,
  premium: 'مميزة',
  packs: {
    'pack-lite-v1': { name: 'Boost 80' },
    'pack-flash-v1': { name: 'Boost 75 Pro' },
  },
  askAboutPack: (name) => `اسأل عن ${name}`,
  faqEyebrow: 'الأسئلة',
  faqTitle: 'إجابات واضحة قبل أن تبدأ.',
  termsReviewNote: 'نؤكد شروط الدفع والتفعيل والتجديد والتعاقد أثناء الحجز.',
  faq: [
    {
      icon: 'stack',
      question: 'ماذا يحدث عندما ينتهي رصيدي؟',
      answer:
        'تتوقف أداة التجربة عن الظهور للمتسوقين، لذلك لن يرى زوار متجرك زرًا لا يعمل. أضف رصيدًا أو انتقل إلى خطة أعلى لإعادتها.',
    },
    {
      icon: 'clock',
      question: 'هل ينتقل الرصيد غير المستخدم للشهر التالي؟',
      answer:
        'يتجدد رصيد الخطة في نهاية كل فترة فوترة. يستمر رصيد الحزم الإضافية لمدة 365 يومًا، ويمكن أن ينتقل بين فترات الخطة النشطة.',
      truthRecordId: 'pricing.topups-valid-365-days',
    },
    {
      icon: 'card',
      question: 'كيف أدفع؟',
      answer:
        'لا تحتاج إلى بطاقة الآن. يمكنك الدفع بتحويل بنكي أو Instapay أو Vodafone Cash، ونفعّل خطتك في اليوم نفسه.',
      truthRecordId: 'pricing.manual-payment-same-day-activation',
    },
    {
      icon: 'refund',
      question: 'ماذا يحدث إذا فشلت عملية التوليد؟',
      answer: 'يعود الرصيد تلقائيًا. أنت تدفع فقط مقابل الصور التي تستلمها بنجاح.',
    },
    {
      icon: 'swap',
      question: 'هل يمكنني تغيير الخطة؟',
      answer:
        'نعم. تبدأ الترقية فورًا، ويبدأ التخفيض إلى خطة أقل مع فترة الفوترة التالية.',
    },
    {
      icon: 'note',
      question: 'هل يوجد عقد؟',
      answer: 'لا. الخطط شهرية ولا تتطلب عقدًا طويل الأجل.',
      truthRecordId: 'pricing.month-to-month-no-contract',
    },
  ],
  ctaTitle: 'هل تريد أن تبدو التجربة جزءًا طبيعيًا من متجرك؟',
  ctaBody: 'احجز مكالمة قصيرة. سنقترح الخطة المناسبة ونرتب خطوات الإعداد معك.',
};

export function getPricingCopy(locale: SiteLocale): PricingCopy {
  return locale === 'ar' ? ar : en;
}
