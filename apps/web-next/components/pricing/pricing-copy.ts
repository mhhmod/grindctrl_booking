import type { SiteLocale } from '@/lib/landing/landing-i18n';

type PlanCopy = {
  name: string;
  description: string;
  benefits: string[];
};

type PackCopy = {
  name: string;
};

export type PricingCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  bookCall: string;
  tryDemo: string;
  marketLabel: string;
  marketLead: string;
  plansEyebrow: string;
  plansTitle: string;
  plansBody: string;
  recommended: string;
  month: string;
  tryOnsPerMonth: (count: string) => string;
  standardQuality: string;
  premiumQuality: string;
  choosePlan: (name: string) => string;
  bookCallForPlan: (name: string) => string;
  plans: Record<string, PlanCopy>;
  packsEyebrow: string;
  packsTitle: string;
  packsBody: string;
  oneTime: string;
  renders: (count: string) => string;
  validFor: (days: string) => string;
  premium: string;
  packs: Record<string, PackCopy>;
  askAboutPack: string;
  faqEyebrow: string;
  faqTitle: string;
  termsReviewNote: string;
  faq: Array<{ question: string; answer: string; truthRecordId?: string }>;
  ctaTitle: string;
  ctaBody: string;
  pricing: string;
};

const en: PricingCopy = {
  eyebrow: 'AI Try-On pricing',
  title: 'More shopper confidence, priced for real usage.',
  intro:
    'Start free, move up when try-on becomes part of your store, or ask us to scope the service options available for your plan.',
  bookCall: 'Book a pricing call',
  tryDemo: 'Try the live demo',
  marketLabel: 'Market position',
  marketLead: 'Entry plans from other Shopify try-on apps typically include 100 to 150 try-ons a month.',
  plansEyebrow: 'Monthly plans',
  plansTitle: 'Pick the level of support your store needs.',
  plansBody:
    'Plan credits are charged for delivered images. Failed generations return the reserved customer credit; upstream provider cost may still be incurred.',
  recommended: 'Recommended',
  month: 'month',
  tryOnsPerMonth: (count) => `${count} try-ons per month`,
  standardQuality: 'Standard image quality',
  premiumQuality: 'Premium image quality',
  choosePlan: (name) => `Choose ${name}`,
  bookCallForPlan: (name) => `Book a call about ${name}`,
  plans: {
    'free-v1': {
      name: 'Free',
      description: 'Test the live storefront experience before you commit.',
      benefits: ['No card required', 'A simple starting point for one store'],
    },
    'launch-v1': {
      name: 'Launch',
      description: 'The best value for stores ready to make try-on part of the buying journey.',
      benefits: ['Our best value for a growing store', 'Top-ups may be available; confirm during booking'],
    },
    'dfy-v1': {
      name: 'Done-for-you',
      description: 'Premium output with service scope confirmed before activation.',
      benefits: [
        'Implementation scope confirmed during booking',
        'Brand options reviewed before activation',
      ],
    },
  },
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
  askAboutPack: 'Ask about this pack',
  faqEyebrow: 'Questions',
  faqTitle: 'Straight answers before you start.',
  termsReviewNote: 'Payment, activation, renewal, and contract terms are confirmed during booking.',
  faq: [
    {
      question: 'What happens when I run out of credits?',
      answer:
        'The try-on widget stops showing to shoppers, so your store never displays a broken button. Top up your credits or upgrade your plan to bring it back.',
    },
    {
      question: 'Do unused credits roll over?',
      answer:
        'Plan credits reset at the end of each billing period. Top-up credits last for 365 days and can carry across active plan periods.',
      truthRecordId: 'pricing.topups-valid-365-days',
    },
    {
      question: 'How do I pay?',
      answer:
        'No card is needed right now. Pay by bank transfer, Instapay, or Vodafone Cash, and we activate your plan the same day.',
      truthRecordId: 'pricing.manual-payment-same-day-activation',
    },
    {
      question: 'What happens if a generation fails?',
      answer:
        'The credit is refunded automatically. You only pay for images that are delivered successfully.',
    },
    {
      question: 'Can I change plans?',
      answer:
        'Yes. Upgrades apply immediately. Downgrades take effect at the start of your next billing period.',
    },
    {
      question: 'Is there a contract?',
      answer: 'No. Plans are month to month, with no long-term contract.',
      truthRecordId: 'pricing.month-to-month-no-contract',
    },
  ],
  ctaTitle: 'Want try-on to feel native to your store?',
  ctaBody: 'Book a short call. We will recommend the right plan and map the setup with you.',
  pricing: 'Pricing',
};

const ar: PricingCopy = {
  eyebrow: 'أسعار تجربة الملابس بالذكاء الاصطناعي',
  title: 'ثقة أكبر للمتسوق، بسعر يناسب الاستخدام الحقيقي.',
  intro:
    'ابدأ مجانًا، وانتقل إلى خطة أعلى عندما تصبح التجربة جزءًا من متجرك، أو اطلب منا تحديد خيارات الخدمة المتاحة لخطتك.',
  bookCall: 'احجز مكالمة للأسعار',
  tryDemo: 'جرّب النسخة المباشرة',
  marketLabel: 'موقعنا في السوق',
  marketLead: 'تتضمن الخطط الأساسية في تطبيقات تجربة الملابس الأخرى على Shopify من 100 إلى 150 تجربة شهريًا.',
  plansEyebrow: 'الخطط الشهرية',
  plansTitle: 'اختر مستوى الدعم المناسب لمتجرك.',
  plansBody:
    'يُخصم رصيد الخطة مقابل الصور التي تم تسليمها. تعيد العملية الفاشلة رصيد العميل المحجوز، وقد تبقى تكلفة مزود الخدمة قائمة.',
  recommended: 'موصى بها',
  month: 'شهر',
  tryOnsPerMonth: (count) => `${count} تجربة كل شهر`,
  standardQuality: 'جودة صور قياسية',
  premiumQuality: 'جودة صور مميزة',
  choosePlan: (name) => `اختر ${name}`,
  bookCallForPlan: (name) => `احجز مكالمة عن ${name}`,
  plans: {
    'free-v1': {
      name: 'مجاني',
      description: 'اختبر تجربة المتجر المباشرة قبل الالتزام.',
      benefits: ['لا تحتاج إلى بطاقة', 'بداية بسيطة لمتجر واحد'],
    },
    'launch-v1': {
      name: 'انطلاق',
      description: 'أفضل قيمة للمتاجر الجاهزة لجعل التجربة جزءًا من رحلة الشراء.',
      benefits: ['أفضل قيمة لمتجر في مرحلة النمو', 'قد تتوفر أرصدة إضافية؛ نؤكدها أثناء الحجز'],
    },
    'dfy-v1': {
      name: 'خدمة متكاملة',
      description: 'صور مميزة مع تأكيد نطاق الخدمة قبل التفعيل.',
      benefits: [
        'تأكيد نطاق التنفيذ أثناء الحجز',
        'مراجعة خيارات الهوية قبل التفعيل',
      ],
    },
  },
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
  askAboutPack: 'اسأل عن هذه الحزمة',
  faqEyebrow: 'الأسئلة',
  faqTitle: 'إجابات واضحة قبل أن تبدأ.',
  termsReviewNote: 'نؤكد شروط الدفع والتفعيل والتجديد والتعاقد أثناء الحجز.',
  faq: [
    {
      question: 'ماذا يحدث عندما ينتهي رصيدي؟',
      answer:
        'تتوقف أداة التجربة عن الظهور للمتسوقين، لذلك لن يرى زوار متجرك زرًا لا يعمل. أضف رصيدًا أو انتقل إلى خطة أعلى لإعادتها.',
    },
    {
      question: 'هل ينتقل الرصيد غير المستخدم للشهر التالي؟',
      answer:
        'يتجدد رصيد الخطة في نهاية كل فترة فوترة. يستمر رصيد الحزم الإضافية لمدة 365 يومًا، ويمكن أن ينتقل بين فترات الخطة النشطة.',
      truthRecordId: 'pricing.topups-valid-365-days',
    },
    {
      question: 'كيف أدفع؟',
      answer:
        'لا تحتاج إلى بطاقة الآن. يمكنك الدفع بتحويل بنكي أو Instapay أو Vodafone Cash، ونفعّل خطتك في اليوم نفسه.',
      truthRecordId: 'pricing.manual-payment-same-day-activation',
    },
    {
      question: 'ماذا يحدث إذا فشلت عملية التوليد؟',
      answer: 'يعود الرصيد تلقائيًا. أنت تدفع فقط مقابل الصور التي تستلمها بنجاح.',
    },
    {
      question: 'هل يمكنني تغيير الخطة؟',
      answer:
        'نعم. تبدأ الترقية فورًا، ويبدأ التخفيض إلى خطة أقل مع فترة الفوترة التالية.',
    },
    {
      question: 'هل يوجد عقد؟',
      answer: 'لا. الخطط شهرية ولا تتطلب عقدًا طويل الأجل.',
      truthRecordId: 'pricing.month-to-month-no-contract',
    },
  ],
  ctaTitle: 'هل تريد أن تبدو التجربة جزءًا طبيعيًا من متجرك؟',
  ctaBody: 'احجز مكالمة قصيرة. سنقترح الخطة المناسبة ونرتب خطوات الإعداد معك.',
  pricing: 'الأسعار',
};

export function getPricingCopy(locale: SiteLocale): PricingCopy {
  return locale === 'ar' ? ar : en;
}
