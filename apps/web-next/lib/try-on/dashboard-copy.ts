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
  noShopsYet: string;
  columnShop: string;
  columnStatus: string;
  columnGenerations: string;
  columnLastGeneration: string;
  noneYet: string;

  planAndCredits: string;
  planAndCreditsBody: string;

  appearance: string;
  appearanceBody: string;

  recentGenerationsBody: string;
  noGenerationsYet: string;
  columnProduct: string;
  columnCost: string;
  columnTime: string;
  columnWhen: string;
  demoShop: string;
  noData: string;

  shopifyApp: string;
  shopifyAppBody: string;
  openShopifyApp: string;

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
  noShopsYet:
    'No shop has opened the app yet. Once a merchant opens it from their Shopify admin, they appear here and can be configured individually.',
  columnShop: 'Shop',
  columnStatus: 'Status',
  columnGenerations: 'Generations',
  columnLastGeneration: 'Last generation',
  noneYet: 'None yet',

  planAndCredits: 'Plan and credits',
  planAndCreditsBody:
    'Payment is collected outside the app, so activating here is what grants credits. Every action is recorded in the ledger with its payment reference.',

  appearance: 'Appearance and journey',
  appearanceBody:
    'The same controls the merchant sees in their Shopify admin, writing to the same record. Changes go live within a minute.',

  recentGenerationsBody: 'The last 25 live jobs, newest first, with what each cost.',
  noGenerationsYet:
    'No generations yet. Run a try-on from a storefront and it lands here with its cost and timing.',
  columnProduct: 'Product',
  columnCost: 'Cost',
  columnTime: 'Time',
  columnWhen: 'When',
  demoShop: 'Demo',
  noData: 'No data',

  shopifyApp: 'Shopify app',
  shopifyAppBody:
    'Merchants install and configure from their own admin. This is what they open.',
  openShopifyApp: 'Open the Shopify app',

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
  noShopsYet:
    'لم يفتح أي متجر التطبيق بعد. بمجرد أن يفتحه تاجر من لوحة شوبيفاي الخاصة به، سيظهر هنا ويمكن ضبطه بشكل منفصل.',
  columnShop: 'المتجر',
  columnStatus: 'الحالة',
  columnGenerations: 'عمليات التوليد',
  columnLastGeneration: 'آخر عملية توليد',
  noneYet: 'لا شيء بعد',

  planAndCredits: 'الخطة والأرصدة',
  planAndCreditsBody:
    'يتم تحصيل الدفع خارج التطبيق، لذا فإن التفعيل من هنا هو ما يمنح الأرصدة. كل إجراء يُسجَّل في السجل مع مرجع الدفع الخاص به.',

  appearance: 'المظهر ورحلة العميل',
  appearanceBody:
    'نفس عناصر التحكم التي يراها التاجر في لوحة شوبيفاي، وتكتب في السجل نفسه. تظهر التغييرات خلال دقيقة.',

  recentGenerationsBody: 'آخر ٢٥ عملية مباشرة، الأحدث أولاً، مع تكلفة كل منها.',
  noGenerationsYet:
    'لا توجد عمليات توليد بعد. شغّل تجربة قياس من أي متجر وستظهر هنا مع تكلفتها وزمنها.',
  columnProduct: 'المنتج',
  columnCost: 'التكلفة',
  columnTime: 'الزمن',
  columnWhen: 'التوقيت',
  demoShop: 'تجريبي',
  noData: 'لا توجد بيانات',

  shopifyApp: 'تطبيق شوبيفاي',
  shopifyAppBody: 'يقوم التجار بالتثبيت والضبط من لوحاتهم الخاصة. هذا ما يفتحونه.',
  openShopifyApp: 'افتح تطبيق شوبيفاي',

  editing: 'التعديل على',
};

export function getTryOnDashboardCopy(locale: SiteLocale): TryOnDashboardCopy {
  return locale === 'ar' ? ar : en;
}
