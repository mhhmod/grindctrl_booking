import type { RoiScenarioField, RoiScenarioValidationError } from '@/lib/roi-calculator';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

export interface RoiCopy {
  pageLabel: string;
  brandHome: string;
  home: string;
  pricing: string;
  bookCall: string;
  viewPricing: string;
  eyebrow: string;
  title: string;
  intro: string;
  thesis: string;
  inputsTitle: string;
  inputsBody: string;
  scenarioTitle: string;
  scenarioBody: string;
  resetScenario: string;
  fields: Record<RoiScenarioField, { label: string; help: string }>;
  currency: string;
  percentagePoints: string;
  resultsTitle: string;
  resultsBody: string;
  fixInputs: string;
  baselineOrders: string;
  baselineRevenue: string;
  scenarioOrders: string;
  scenarioRevenue: string;
  incrementalRevenue: string;
  avoidedReturnValue: string;
  grossMarginImpact: string;
  netImpact: string;
  roi: string;
  notAvailable: string;
  costNeeded: string;
  supportScope: string;
  leadContext: string;
  notMonetized: string;
  formulaTitle: string;
  formulaBody: string;
  formulas: Array<{ label: string; formula: string }>;
  disclaimerTitle: string;
  disclaimer: string;
  noCausation: string;
  errors: Record<RoiScenarioValidationError['code'], string>;
}

const en: RoiCopy = {
  pageLabel: 'ROI scenario calculator',
  brandHome: 'GrindCTRL home',
  home: 'Home',
  pricing: 'Pricing',
  bookCall: 'Book a call',
  viewPricing: 'View pricing',
  eyebrow: 'Business-case worksheet',
  title: 'Put your store numbers on the table.',
  intro:
    'Build an illustrative scenario from your own traffic, conversion, order value, returns, margin, and cost. Every assumption stays visible and editable.',
  thesis: 'Sessions × conversion × order value. Then margin, returns, and cost.',
  inputsTitle: 'Your operating inputs',
  inputsBody: 'Use a typical recent month. Optional volumes are shown as operational context and are not assigned invented financial value.',
  scenarioTitle: 'Your selected scenario',
  scenarioBody:
    'All improvement controls start at zero. Enter only assumptions you want to test; percentage changes are percentage points.',
  resetScenario: 'Reset assumptions to zero',
  fields: {
    monthlySessions: { label: 'Monthly store sessions', help: 'Visits in a typical month.' },
    baselineConversionRate: { label: 'Baseline conversion rate', help: 'Current orders per 100 sessions.' },
    averageOrderValue: { label: 'Average order value', help: 'Average booked value per order.' },
    returnRate: { label: 'Baseline return rate', help: 'Current returned share of booked sales.' },
    grossMarginRate: { label: 'Gross margin rate', help: 'Margin after product cost, before software/service cost.' },
    monthlyCost: { label: 'Estimated monthly software/service cost', help: 'Optional. ROI needs a cost above zero.' },
    supportVolume: { label: 'Monthly support conversations', help: 'Optional operational context.' },
    leadVolume: { label: 'Monthly leads', help: 'Optional context; no lead value is assumed.' },
    conversionImprovement: { label: 'Conversion improvement', help: 'Percentage points added to your baseline.' },
    returnReduction: { label: 'Return-rate reduction', help: 'Percentage points removed from your baseline.' },
    supportAutomationRate: { label: 'Support automation scope', help: 'Share of support volume included in this scenario.' },
  },
  currency: 'Currency',
  percentagePoints: 'pp',
  resultsTitle: 'Illustrative monthly view',
  resultsBody: 'Booked revenue and gross-margin contribution are kept separate.',
  fixInputs: 'Correct the highlighted inputs to calculate this scenario.',
  baselineOrders: 'Baseline orders',
  baselineRevenue: 'Baseline booked revenue',
  scenarioOrders: 'Scenario orders',
  scenarioRevenue: 'Scenario booked revenue',
  incrementalRevenue: 'Potential incremental revenue',
  avoidedReturnValue: 'Potential avoided return value',
  grossMarginImpact: 'Illustrative gross-margin impact',
  netImpact: 'Illustrative net impact',
  roi: 'Illustrative ROI',
  notAvailable: 'Not available',
  costNeeded: 'Enter a monthly cost above zero to calculate ROI.',
  supportScope: 'Support conversations in selected automation scope',
  leadContext: 'Monthly leads entered as context',
  notMonetized: 'Not monetized in this model',
  formulaTitle: 'Calculation tape',
  formulaBody: 'The calculator uses these formulas; no benchmark or GrindCTRL uplift is inserted.',
  formulas: [
    { label: 'Baseline orders', formula: 'sessions × baseline conversion rate' },
    { label: 'Baseline booked revenue', formula: 'baseline orders × average order value' },
    { label: 'Scenario booked revenue', formula: 'sessions × (baseline conversion + selected improvement) × average order value' },
    { label: 'Avoided return value', formula: 'scenario booked revenue × selected return-rate reduction' },
    { label: 'Gross-margin impact', formula: '((incremental revenue × (1 − baseline return rate)) + avoided return value) × gross margin rate' },
    { label: 'Net impact', formula: 'gross-margin impact − monthly software/service cost' },
    { label: 'ROI', formula: 'net impact ÷ monthly software/service cost × 100' },
  ],
  disclaimerTitle: 'Scenario, not a promise',
  disclaimer:
    'Results are illustrative estimates based on the merchant’s inputs and selected assumptions. They are not guaranteed performance claims.',
  noCausation:
    'This worksheet does not establish that GrindCTRL caused or will cause any conversion, return, support, or revenue change.',
  errors: {
    'not-finite': 'Enter a number.',
    negative: 'Enter zero or a positive number.',
    'above-100': 'Enter a percentage from 0 to 100.',
    'conversion-above-100': 'Baseline plus improvement cannot exceed 100%.',
    'return-reduction-above-rate': 'Reduction cannot exceed the baseline return rate.',
  },
};

const ar: RoiCopy = {
  pageLabel: 'حاسبة سيناريو العائد',
  brandHome: 'الصفحة الرئيسية لـ GrindCTRL',
  home: 'الرئيسية',
  pricing: 'الأسعار',
  bookCall: 'احجز مكالمة',
  viewPricing: 'شاهد الأسعار',
  eyebrow: 'ورقة عمل لدراسة الجدوى',
  title: 'ضع أرقام متجرك على الطاولة.',
  intro:
    'أنشئ سيناريو توضيحيًا باستخدام زيارات متجرك ومعدل التحويل ومتوسط قيمة الطلب والمرتجعات والهامش والتكلفة. تبقى كل الافتراضات ظاهرة وقابلة للتعديل.',
  thesis: 'الزيارات × التحويل × قيمة الطلب. ثم الهامش والمرتجعات والتكلفة.',
  inputsTitle: 'بيانات التشغيل الخاصة بك',
  inputsBody: 'استخدم شهرًا حديثًا معتادًا. تظهر الأحجام الاختيارية كسياق تشغيلي من دون افتراض قيمة مالية لها.',
  scenarioTitle: 'السيناريو الذي اخترته',
  scenarioBody:
    'تبدأ كل افتراضات التحسن من الصفر. أدخل فقط الافتراضات التي تريد اختبارها؛ التغييرات بالنقاط المئوية.',
  resetScenario: 'إعادة الافتراضات إلى الصفر',
  fields: {
    monthlySessions: { label: 'زيارات المتجر الشهرية', help: 'عدد الزيارات في شهر معتاد.' },
    baselineConversionRate: { label: 'معدل التحويل الأساسي', help: 'عدد الطلبات الحالي لكل 100 زيارة.' },
    averageOrderValue: { label: 'متوسط قيمة الطلب', help: 'متوسط القيمة المسجلة لكل طلب.' },
    returnRate: { label: 'معدل المرتجعات الأساسي', help: 'النسبة الحالية للمرتجعات من المبيعات المسجلة.' },
    grossMarginRate: { label: 'هامش الربح الإجمالي', help: 'الهامش بعد تكلفة المنتج وقبل تكلفة البرنامج أو الخدمة.' },
    monthlyCost: { label: 'التكلفة الشهرية المقدرة للبرنامج أو الخدمة', help: 'اختياري. يحتاج حساب العائد إلى تكلفة أكبر من صفر.' },
    supportVolume: { label: 'محادثات الدعم الشهرية', help: 'سياق تشغيلي اختياري.' },
    leadVolume: { label: 'العملاء المحتملون شهريًا', help: 'سياق اختياري؛ لا نفترض قيمة مالية للعميل المحتمل.' },
    conversionImprovement: { label: 'تحسن معدل التحويل', help: 'نقاط مئوية تضاف إلى المعدل الأساسي.' },
    returnReduction: { label: 'انخفاض معدل المرتجعات', help: 'نقاط مئوية تخصم من المعدل الأساسي.' },
    supportAutomationRate: { label: 'نطاق أتمتة الدعم', help: 'حصة محادثات الدعم المشمولة في هذا السيناريو.' },
  },
  currency: 'العملة',
  percentagePoints: 'نقطة مئوية',
  resultsTitle: 'عرض شهري توضيحي',
  resultsBody: 'نفصل بين الإيراد المسجل ومساهمة هامش الربح الإجمالي.',
  fixInputs: 'صحّح الحقول المحددة لحساب هذا السيناريو.',
  baselineOrders: 'الطلبات الأساسية',
  baselineRevenue: 'الإيراد الأساسي المسجل',
  scenarioOrders: 'طلبات السيناريو',
  scenarioRevenue: 'إيراد السيناريو المسجل',
  incrementalRevenue: 'الإيراد الإضافي المحتمل',
  avoidedReturnValue: 'قيمة المرتجعات التي يمكن تجنبها',
  grossMarginImpact: 'الأثر التوضيحي على هامش الربح',
  netImpact: 'الأثر الصافي التوضيحي',
  roi: 'العائد التوضيحي',
  notAvailable: 'غير متاح',
  costNeeded: 'أدخل تكلفة شهرية أكبر من صفر لحساب العائد.',
  supportScope: 'محادثات الدعم ضمن نطاق الأتمتة المختار',
  leadContext: 'العملاء المحتملون المدخلون كسياق',
  notMonetized: 'لا تُحتسب لها قيمة مالية في هذا النموذج',
  formulaTitle: 'شريط الحساب',
  formulaBody: 'تستخدم الحاسبة هذه المعادلات ولا تضيف معيارًا خارجيًا أو تحسنًا مفترضًا من GrindCTRL.',
  formulas: [
    { label: 'الطلبات الأساسية', formula: 'الزيارات × معدل التحويل الأساسي' },
    { label: 'الإيراد الأساسي المسجل', formula: 'الطلبات الأساسية × متوسط قيمة الطلب' },
    { label: 'إيراد السيناريو المسجل', formula: 'الزيارات × (التحويل الأساسي + التحسن المختار) × متوسط قيمة الطلب' },
    { label: 'قيمة المرتجعات المتجنبة', formula: 'إيراد السيناريو المسجل × الانخفاض المختار في معدل المرتجعات' },
    { label: 'أثر هامش الربح', formula: '((الإيراد الإضافي × (1 − معدل المرتجعات الأساسي)) + قيمة المرتجعات المتجنبة) × هامش الربح' },
    { label: 'الأثر الصافي', formula: 'أثر هامش الربح − التكلفة الشهرية للبرنامج أو الخدمة' },
    { label: 'العائد', formula: 'الأثر الصافي ÷ التكلفة الشهرية للبرنامج أو الخدمة × 100' },
  ],
  disclaimerTitle: 'سيناريو وليس وعدًا',
  disclaimer:
    'النتائج تقديرات توضيحية تعتمد على بيانات المتجر والافتراضات التي اختارها. وهي ليست وعودًا بأداء مضمون.',
  noCausation:
    'لا تثبت ورقة العمل هذه أن GrindCTRL تسبب أو سيتسبب في أي تغير في التحويل أو المرتجعات أو الدعم أو الإيرادات.',
  errors: {
    'not-finite': 'أدخل رقمًا.',
    negative: 'أدخل صفرًا أو رقمًا موجبًا.',
    'above-100': 'أدخل نسبة بين 0 و100.',
    'conversion-above-100': 'لا يمكن أن يتجاوز المعدل الأساسي مع التحسن 100%.',
    'return-reduction-above-rate': 'لا يمكن أن يتجاوز الانخفاض معدل المرتجعات الأساسي.',
  },
};

export function getRoiCopy(locale: SiteLocale): RoiCopy {
  return locale === 'ar' ? ar : en;
}
