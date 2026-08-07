/* Copy for the try-on dashboard page and its settings panel.

   Separate from settings-copy.ts on purpose: that module is shared with the
   Shopify embedded admin and must stay limited to the controls both surfaces
   render. This one is the dashboard's own scaffolding, which Shopify does not
   have. */

import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface TryOnDashboardCopy {
  installedShops: string;
  recentGenerations: string;
  avgGenerationTime: string;
  noDataYet: string;
  providerSpend: string;

  merchantShops: string;
  merchantShopsBody: string;
  columnShop: string;
  columnStatus: string;
  columnGenerations: string;
  columnLastGeneration: string;

  planAndCredits: string;
  planAndCreditsBody: string;

  appearance: string;
  appearanceBody: string;

  editing: string;
}

const en: TryOnDashboardCopy = {
  installedShops: 'Installed shops',
  recentGenerations: 'Recent generations',
  avgGenerationTime: 'Avg generation time',
  noDataYet: 'No data yet',
  providerSpend: 'Provider spend (recent)',

  merchantShops: 'Merchant shops',
  merchantShopsBody:
    'A shop appears the first time its admin opens the app, and drops to uninstalled when Shopify tells us it was removed.',
  columnShop: 'Shop',
  columnStatus: 'Status',
  columnGenerations: 'Generations',
  columnLastGeneration: 'Last generation',

  planAndCredits: 'Plan and credits',
  planAndCreditsBody:
    'Payment is collected outside the app, so activating here is what grants credits. Every action is recorded in the ledger with its payment reference.',

  appearance: 'Appearance and journey',
  appearanceBody:
    'The same controls the merchant sees in their Shopify admin, writing to the same record. Changes go live within a minute.',

  editing: 'Editing',
};

const ar: TryOnDashboardCopy = {
  installedShops: 'المتاجر المثبَّتة',
  recentGenerations: 'أحدث عمليات التوليد',
  avgGenerationTime: 'متوسط زمن التوليد',
  noDataYet: 'لا توجد بيانات بعد',
  providerSpend: 'تكلفة المزود (الأخيرة)',

  merchantShops: 'متاجر التجار',
  merchantShopsBody:
    'يظهر المتجر أول مرة يفتح فيها مسؤوله التطبيق، ويتحول إلى غير مثبَّت عندما تخبرنا شوبيفاي بإزالته.',
  columnShop: 'المتجر',
  columnStatus: 'الحالة',
  columnGenerations: 'عمليات التوليد',
  columnLastGeneration: 'آخر عملية توليد',

  planAndCredits: 'الخطة والأرصدة',
  planAndCreditsBody:
    'يتم تحصيل الدفع خارج التطبيق، لذا فإن التفعيل من هنا هو ما يمنح الأرصدة. كل إجراء يُسجَّل في السجل مع مرجع الدفع الخاص به.',

  appearance: 'المظهر ورحلة العميل',
  appearanceBody:
    'نفس عناصر التحكم التي يراها التاجر في لوحة شوبيفاي، وتكتب في السجل نفسه. تظهر التغييرات خلال دقيقة.',

  editing: 'التعديل على',
};

export function getTryOnDashboardCopy(locale: SiteLocale): TryOnDashboardCopy {
  return locale === 'ar' ? ar : en;
}
