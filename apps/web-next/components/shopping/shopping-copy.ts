import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface ShoppingFact {
  title: string;
  body: string;
}

export interface ShoppingCopy {
  eyebrow: string;
  title: string;
  lead: string;
  ctaBookCall: string;
  ctaTryDemo: string;
  ctaViewPricing: string;

  privacyEyebrow: string;
  privacyTitle: string;
  privacyBody: string;
  privacyFacts: ShoppingFact[];

  reliabilityEyebrow: string;
  reliabilityTitle: string;
  reliabilityBody: string;

  catalogEyebrow: string;
  catalogTitle: string;
  catalogBody: string;

  bilingualEyebrow: string;
  bilingualTitle: string;
  bilingualBody: string;

  cartEyebrow: string;
  cartTitle: string;
  cartBody: string;

  plansEyebrow: string;
  plansTitle: string;
  plansBody: string;

  closingEyebrow: string;
  closingTitle: string;
  closingBody: string;
}

const en: ShoppingCopy = {
  eyebrow: 'AI Shopping',
  title: 'See it on, before you buy',
  lead: 'Shoppers upload a photo and get an AI-generated preview of your product on them, right on the product page.',
  ctaBookCall: 'Book a call',
  ctaTryDemo: 'Try the live demo',
  ctaViewPricing: 'View pricing',

  privacyEyebrow: 'Privacy',
  privacyTitle: "Where the photo goes, and when it's deleted",
  privacyBody: "Try-on handles a real customer photo, so here's exactly what happens to it.",
  privacyFacts: [
    {
      title: 'Sent to an AI provider for processing',
      body: 'The uploaded photo is sent to a third-party AI provider to generate the preview.',
    },
    {
      title: "Not stored permanently by GrindCTRL",
      body: "GrindCTRL doesn't save the source photo to its own database.",
    },
    {
      title: 'Generated preview is deleted automatically',
      body: 'The AI-generated result is kept privately for about 30 minutes, then removed by a cleanup job that runs every 10 minutes.',
    },
  ],

  reliabilityEyebrow: 'Reliability',
  reliabilityTitle: 'A clear message when generation fails, not an error code',
  reliabilityBody:
    "If a photo can't be processed, shoppers see a friendly explanation in their own language, never a raw technical error. Try-on is designed not to charge a credit for a failed generation.",

  catalogEyebrow: 'Your catalog',
  catalogTitle: 'Add it to any product page',
  catalogBody: "There's no curated category list to qualify for. The try-on block works on any product page in your store.",

  bilingualEyebrow: 'Bilingual',
  bilingualTitle: 'English and Arabic, including right-to-left layout',
  bilingualBody:
    'Photo upload, consent, and the generated result are fully translated, with the layout mirrored correctly for Arabic.',

  cartEyebrow: 'Preview to cart',
  cartTitle: 'Try it on, then add straight to cart',
  cartBody: 'Shoppers can add the previewed product to their cart without leaving the try-on preview.',

  plansEyebrow: 'Plans & credits',
  plansTitle: 'A free tier, paid plans, and credit top-ups',
  plansBody:
    'Every plan includes monthly try-on credits, and top-up packs are available when a store needs more. Current plans and credits are on the pricing page.',

  closingEyebrow: 'Get started',
  closingTitle: 'See how it looks on your catalog',
  closingBody: 'Book a call to walk through setup, or try the live demo yourself.',
};

const ar: ShoppingCopy = {
  eyebrow: 'التسوق بالذكاء الاصطناعي',
  title: 'شاهده عليك قبل الشراء',
  lead: 'يرفع المتسوق صورته، فيحصل على معاينة ينشئها الذكاء الاصطناعي للمنتج عليه، مباشرة في صفحة المنتج.',
  ctaBookCall: 'احجز مكالمة',
  ctaTryDemo: 'جرّب العرض الحي',
  ctaViewPricing: 'شاهد الأسعار',

  privacyEyebrow: 'الخصوصية',
  privacyTitle: 'إلى أين تذهب الصورة، ومتى تُحذف',
  privacyBody: 'التجربة الافتراضية تتعامل مع صورة حقيقية للعميل، وهذا بالضبط ما يحدث لها.',
  privacyFacts: [
    {
      title: 'تُرسل إلى مزوّد ذكاء اصطناعي للمعالجة',
      body: 'تُرسل الصورة المرفوعة إلى مزوّد خارجي متخصص في الذكاء الاصطناعي لإنشاء المعاينة.',
    },
    {
      title: 'لا تُخزَّن بشكل دائم لدى GrindCTRL',
      body: 'لا تحفظ GrindCTRL صورة العميل الأصلية في قاعدة بياناتها.',
    },
    {
      title: 'المعاينة الناتجة تُحذف تلقائيًا',
      body: 'تُحفظ النتيجة الناتجة بشكل خاص لمدة 30 دقيقة تقريبًا، ثم تُحذف عبر مهمة تنظيف تعمل كل 10 دقائق.',
    },
  ],

  reliabilityEyebrow: 'الموثوقية',
  reliabilityTitle: 'رسالة واضحة عند فشل المعاينة، لا رمز خطأ تقني',
  reliabilityBody:
    'إذا تعذّرت معالجة الصورة، يرى المتسوق توضيحًا ودودًا بلغته، وليس خطأ تقنيًا خامًا. التجربة الافتراضية مصممة بحيث لا تخصم رصيدًا عند فشل المعاينة.',

  catalogEyebrow: 'كتالوجك',
  catalogTitle: 'أضفها إلى أي صفحة منتج',
  catalogBody: 'لا توجد قائمة فئات محددة مسبقًا. تعمل أداة التجربة الافتراضية على أي صفحة منتج في متجرك.',

  bilingualEyebrow: 'ثنائية اللغة',
  bilingualTitle: 'الإنجليزية والعربية، بما في ذلك التخطيط من اليمين لليسار',
  bilingualBody: 'رفع الصورة والموافقة والنتيجة الناتجة مترجمة بالكامل، والتخطيط ينعكس بشكل صحيح للعربية.',

  cartEyebrow: 'من المعاينة إلى السلة',
  cartTitle: 'جرّبه، ثم أضِفه إلى السلة مباشرة',
  cartBody: 'يمكن للمتسوق إضافة المنتج الذي عاينه إلى سلته دون مغادرة شاشة المعاينة.',

  plansEyebrow: 'الخطط والأرصدة',
  plansTitle: 'خطة مجانية وخطط مدفوعة وحزم رصيد إضافية',
  plansBody:
    'تتضمن كل خطة رصيد معاينات شهري، وتتوفر حزم رصيد إضافية عندما يحتاج المتجر إلى المزيد. الخطط والأرصدة الحالية موجودة في صفحة الأسعار.',

  closingEyebrow: 'ابدأ الآن',
  closingTitle: 'شاهد كيف تبدو على كتالوجك',
  closingBody: 'احجز مكالمة لمراجعة خطوات التفعيل، أو جرّب العرض الحي بنفسك.',
};

export function getShoppingCopy(locale: SiteLocale): ShoppingCopy {
  return locale === 'ar' ? ar : en;
}
