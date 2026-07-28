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
  brandHome: string;
  home: string;
  liveDemo: string;
  eyebrow: string;
  title: string;
  intro: string;
  bookCall: string;
  tryDemo: string;
  marketLabel: string;
  marketLead: string;
  marketTail: (renders: string) => string;
  plansEyebrow: string;
  plansTitle: string;
  plansBody: string;
  recommended: string;
  month: string;
  tryOnsPerMonth: (count: string) => string;
  standardQuality: string;
  premiumQuality: string;
  choosePlan: (name: string) => string;
  plans: Record<string, PlanCopy>;
  packsEyebrow: string;
  packsTitle: string;
  packsBody: string;
  oneTime: string;
  renders: (count: string) => string;
  validFor: (days: string) => string;
  premium: string;
  packs: Record<string, PackCopy>;
  faqEyebrow: string;
  faqTitle: string;
  faq: Array<{ question: string; answer: string }>;
  ctaTitle: string;
  ctaBody: string;
  footerTagline: string;
  pricing: string;
};

const en: PricingCopy = {
  brandHome: 'GRINDCTRL home',
  home: 'Home',
  liveDemo: 'Live demo',
  eyebrow: 'AI Try-On pricing',
  title: 'More shopper confidence, priced for real usage.',
  intro:
    'Start free, move up when try-on becomes part of your store, or let us set up and tune the full experience for you.',
  bookCall: 'Book a pricing call',
  tryDemo: 'Try the live demo',
  marketLabel: 'Market position',
  marketLead: 'Entry plans from other Shopify try-on apps typically include 100 to 150 try-ons a month.',
  marketTail: (renders) => `Launch includes ${renders} for $15.`,
  plansEyebrow: 'Monthly plans',
  plansTitle: 'Pick the level of support your store needs.',
  plansBody:
    'Every plan includes delivered-image billing. Failed generations are refunded automatically.',
  recommended: 'Recommended',
  month: 'month',
  tryOnsPerMonth: (count) => `${count} try-ons per month`,
  standardQuality: 'Standard image quality',
  premiumQuality: 'Premium image quality',
  choosePlan: (name) => `Choose ${name}`,
  plans: {
    'free-v1': {
      name: 'Free',
      description: 'Test the live storefront experience before you commit.',
      benefits: ['No card required', 'A simple starting point for one store'],
    },
    'launch-v1': {
      name: 'Launch',
      description: 'The best value for stores ready to make try-on part of the buying journey.',
      benefits: ['Best price per delivered try-on', 'Top-ups available when you need them'],
    },
    'dfy-v1': {
      name: 'Done-for-you',
      description: 'Premium output plus hands-on setup and ongoing care from GrindCTRL.',
      benefits: [
        'Theme setup included',
        'Brand tuning',
        'Monthly check-in',
        'Priority support',
      ],
    },
  },
  packsEyebrow: 'Top-up packs',
  packsTitle: 'Add credits without changing your plan.',
  packsBody: 'One-time packs work with any active plan and stay valid for 365 days.',
  oneTime: 'one time',
  renders: (count) => `${count} renders`,
  validFor: (days) => `Valid for ${days} days`,
  premium: 'Premium',
  packs: {
    'pack-lite-v1': { name: 'Boost 80' },
    'pack-flash-v1': { name: 'Boost 75 Pro' },
  },
  faqEyebrow: 'Questions',
  faqTitle: 'Straight answers before you start.',
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
    },
    {
      question: 'How do I pay?',
      answer:
        'No card is needed right now. Pay by bank transfer, Instapay, or Vodafone Cash, and we activate your plan the same day.',
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
    },
  ],
  ctaTitle: 'Want try-on to feel native to your store?',
  ctaBody: 'Book a short call. We will recommend the right plan and map the setup with you.',
  footerTagline: 'Done-for-you AI Try-On for Shopify stores.',
  pricing: 'Pricing',
};

const ar: PricingCopy = {
  brandHome: 'الصفحة الرئيسية لـ GRINDCTRL',
  home: 'الرئيسية',
  liveDemo: 'تجربة مباشرة',
  eyebrow: 'أسعار تجربة الملابس بالذكاء الاصطناعي',
  title: 'ثقة أكبر للمتسوق، بسعر يناسب الاستخدام الحقيقي.',
  intro:
    'ابدأ مجانًا، وانتقل إلى خطة أعلى عندما تصبح التجربة جزءًا من متجرك، أو دعنا نجهز التجربة بالكامل ونضبطها لك.',
  bookCall: 'احجز مكالمة للأسعار',
  tryDemo: 'جرّب النسخة المباشرة',
  marketLabel: 'موقعنا في السوق',
  marketLead: 'تتضمن الخطط الأساسية في تطبيقات تجربة الملابس الأخرى على Shopify من 100 إلى 150 تجربة شهريًا.',
  marketTail: (renders) => `بينما تتضمن خطة انطلاق ${renders} مقابل 15 دولارًا.`,
  plansEyebrow: 'الخطط الشهرية',
  plansTitle: 'اختر مستوى الدعم المناسب لمتجرك.',
  plansBody:
    'كل الخطط تحاسب على الصور المستلمة فقط. أي عملية توليد تفشل تسترد رصيدها تلقائيًا.',
  recommended: 'موصى بها',
  month: 'شهر',
  tryOnsPerMonth: (count) => `${count} تجربة كل شهر`,
  standardQuality: 'جودة صور قياسية',
  premiumQuality: 'جودة صور مميزة',
  choosePlan: (name) => `اختر ${name}`,
  plans: {
    'free-v1': {
      name: 'مجاني',
      description: 'اختبر تجربة المتجر المباشرة قبل الالتزام.',
      benefits: ['لا تحتاج إلى بطاقة', 'بداية بسيطة لمتجر واحد'],
    },
    'launch-v1': {
      name: 'انطلاق',
      description: 'أفضل قيمة للمتاجر الجاهزة لجعل التجربة جزءًا من رحلة الشراء.',
      benefits: ['أفضل سعر لكل صورة مستلمة', 'أرصدة إضافية عند الحاجة'],
    },
    'dfy-v1': {
      name: 'خدمة متكاملة',
      description: 'صور مميزة مع إعداد عملي ومتابعة مستمرة من GrindCTRL.',
      benefits: [
        'إعداد القالب مشمول',
        'ضبط الهوية البصرية',
        'متابعة شهرية',
        'دعم بأولوية',
      ],
    },
  },
  packsEyebrow: 'حزم الرصيد الإضافي',
  packsTitle: 'أضف رصيدًا دون تغيير خطتك.',
  packsBody: 'تعمل الحزم لمرة واحدة مع أي خطة نشطة، وتظل صالحة لمدة 365 يومًا.',
  oneTime: 'دفعة واحدة',
  renders: (count) => `${count} صورة`,
  validFor: (days) => `صالحة لمدة ${days} يومًا`,
  premium: 'مميزة',
  packs: {
    'pack-lite-v1': { name: 'Boost 80' },
    'pack-flash-v1': { name: 'Boost 75 Pro' },
  },
  faqEyebrow: 'الأسئلة',
  faqTitle: 'إجابات واضحة قبل أن تبدأ.',
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
    },
    {
      question: 'كيف أدفع؟',
      answer:
        'لا تحتاج إلى بطاقة الآن. يمكنك الدفع بتحويل بنكي أو Instapay أو Vodafone Cash، ونفعّل خطتك في اليوم نفسه.',
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
    },
  ],
  ctaTitle: 'هل تريد أن تبدو التجربة جزءًا طبيعيًا من متجرك؟',
  ctaBody: 'احجز مكالمة قصيرة. سنقترح الخطة المناسبة ونرتب خطوات الإعداد معك.',
  footerTagline: 'تجربة ملابس بالذكاء الاصطناعي مجهزة بالكامل لمتاجر Shopify.',
  pricing: 'الأسعار',
};

export function getPricingCopy(locale: SiteLocale): PricingCopy {
  return locale === 'ar' ? ar : en;
}
