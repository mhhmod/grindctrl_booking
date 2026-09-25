export const ANALYTICS_TAXONOMY_VERSION = 1 as const;

export const ANALYTICS_CONSENT_STATES = ['granted', 'denied', 'unknown'] as const;
export type AnalyticsConsentState = (typeof ANALYTICS_CONSENT_STATES)[number];

export const ANALYTICS_SOURCES = [
  'marketing_site',
  'storefront_widget',
  'tryon_widget',
  'dashboard',
  'shopify_app',
  'workflow',
  'api',
] as const;
export type AnalyticsSource = (typeof ANALYTICS_SOURCES)[number];

export const ANALYTICS_CHANNELS = ['web', 'shopify', 'whatsapp', 'instagram', 'messenger', 'telegram', 'voice'] as const;
export type AnalyticsChannel = (typeof ANALYTICS_CHANNELS)[number];

export type AnalyticsEventPayloadMap = {
  'storefront.cta_clicked': {
    cta: 'try_on' | 'book_call' | 'start_trial' | 'choose_plan' | 'ask_about_pack' | 'open_store';
    placement: string;
    planKey?: string;
    packKey?: string;
  };
  'storefront.demo_started': { demo: 'try_on' | 'product_journey' };
  'storefront.demo_completed': { demo: 'try_on' | 'product_journey'; durationMs?: number };
  'storefront.pricing_viewed': Record<never, never>;
  'storefront.signup_started': { placement?: string };
  'storefront.booked_call': { placement?: string };
  'storefront.scroll_depth': { percent: 25 | 50 | 75 | 100 };
  'storefront.product_tab_engaged': { tab: string };
  'storefront.roi_completed': { scenario: 'conservative' | 'expected' | 'ambitious' };
  'storefront.case_study_opened': { caseStudyId: string };
  'storefront.integration_page_viewed': { integrationKey: string };
  'tryon.widget_viewed': { productId?: string; variantId?: string };
  'tryon.opened': { productId?: string; variantId?: string };
  'tryon.photo_selected': { productId?: string; variantId?: string };
  'tryon.photo_uploaded': { productId?: string; variantId?: string };
  'tryon.generation_started': { productId?: string; variantId?: string; flowId?: string };
  'tryon.generation_succeeded': { productId?: string; variantId?: string; durationMs: number; provider?: string; model?: string };
  'tryon.generation_failed': { productId?: string; variantId?: string; durationMs?: number; errorCode: string; retryable: boolean };
  'tryon.result_viewed': { productId?: string; variantId?: string };
  'tryon.product_retried': { productId: string; variantId?: string };
  'tryon.customer_identified': { method: 'account' | 'consented_contact' };
  'tryon.contact_captured': { kind: 'email' | 'phone'; consentRecorded: true };
  'conversation.received': { inputKind: 'text' | 'image' | 'audio' | 'file' };
  'conversation.ai_replied': { durationMs?: number; provider?: string; model?: string };
  'conversation.handoff': { reasonCode: string; humanIntervention: true };
  'lead.created': { sourceType: 'conversation' | 'try_on' | 'form' | 'import' };
  'lead.scored': { scoreBand: 'low' | 'medium' | 'high' };
  'lead.routed': { routeType: 'owner' | 'team' | 'workflow' };
  'workflow.started': { workflowId: string; flowId?: string };
  'workflow.completed': { workflowId: string; flowId?: string; durationMs?: number; resultCode?: string };
  'workflow.failed': { workflowId: string; flowId?: string; durationMs?: number; errorCode: string; retryable: boolean };
  'workflow.human_reviewed': { workflowId: string; flowId?: string; resultCode: string };
  'order.add_to_cart': { productId: string; variantId?: string; influencedByTryOn: boolean };
  'order.checkout_started': { influencedByTryOn: boolean };
  'order.completed': { attribution: 'direct' | 'assisted' | 'influenced' | 'none' };
  'reporting.report_viewed': { report: 'try_on_funnel' | 'customer_journey' | 'workflow' | 'attribution' };
  'reporting.export_requested': { report: 'try_on_funnel' | 'customer_journey' | 'workflow' | 'attribution'; format: 'csv' | 'json' };
  'integration.connected': { integrationKey: string };
  'integration.failed': { integrationKey: string; errorCode: string };
  'billing.credit_consumed': { product: 'try_on' | 'conversation' | 'workflow'; quantity: number };
};

export type AnalyticsEventName = keyof AnalyticsEventPayloadMap;
export type AnalyticsEventScope = 'marketing' | 'tenant';

export type AnalyticsPropertyName = {
  [Name in AnalyticsEventName]: keyof AnalyticsEventPayloadMap[Name];
}[AnalyticsEventName] & string;

export type AnalyticsPropertyRule =
  | { type: 'string'; values?: readonly string[] }
  | { type: 'number'; values?: readonly number[]; integer?: boolean; min?: number }
  | { type: 'boolean'; value?: boolean };

/* Runtime callers do not benefit from TypeScript's payload map. Keep one
   exhaustive rule per property name so every accepted value is checked for
   its primitive type and, where applicable, its finite enum/literal set. */
export const ANALYTICS_PROPERTY_RULES = {
  cta: { type: 'string', values: ['try_on', 'book_call', 'start_trial', 'choose_plan', 'ask_about_pack', 'open_store'] },
  placement: { type: 'string' },
  planKey: { type: 'string' },
  packKey: { type: 'string' },
  demo: { type: 'string', values: ['try_on', 'product_journey'] },
  durationMs: { type: 'number', min: 0 },
  percent: { type: 'number', values: [25, 50, 75, 100] },
  tab: { type: 'string' },
  scenario: { type: 'string', values: ['conservative', 'expected', 'ambitious'] },
  caseStudyId: { type: 'string' },
  integrationKey: { type: 'string' },
  productId: { type: 'string' },
  variantId: { type: 'string' },
  flowId: { type: 'string' },
  provider: { type: 'string' },
  model: { type: 'string' },
  errorCode: { type: 'string' },
  retryable: { type: 'boolean' },
  method: { type: 'string', values: ['account', 'consented_contact'] },
  kind: { type: 'string', values: ['email', 'phone'] },
  consentRecorded: { type: 'boolean', value: true },
  inputKind: { type: 'string', values: ['text', 'image', 'audio', 'file'] },
  reasonCode: { type: 'string' },
  humanIntervention: { type: 'boolean', value: true },
  sourceType: { type: 'string', values: ['conversation', 'try_on', 'form', 'import'] },
  scoreBand: { type: 'string', values: ['low', 'medium', 'high'] },
  routeType: { type: 'string', values: ['owner', 'team', 'workflow'] },
  workflowId: { type: 'string' },
  resultCode: { type: 'string' },
  influencedByTryOn: { type: 'boolean' },
  attribution: { type: 'string', values: ['direct', 'assisted', 'influenced', 'none'] },
  report: { type: 'string', values: ['try_on_funnel', 'customer_journey', 'workflow', 'attribution'] },
  format: { type: 'string', values: ['csv', 'json'] },
  product: { type: 'string', values: ['try_on', 'conversation', 'workflow'] },
  quantity: { type: 'number', integer: true, min: 1 },
} as const satisfies Record<AnalyticsPropertyName, AnalyticsPropertyRule>;

type EventDefinition<Name extends AnalyticsEventName> = {
  scope: AnalyticsEventScope;
  allowedProperties: readonly (keyof AnalyticsEventPayloadMap[Name])[];
  requiredProperties: readonly (keyof AnalyticsEventPayloadMap[Name])[];
};

export const ANALYTICS_EVENTS = {
  'storefront.cta_clicked': { scope: 'marketing', allowedProperties: ['cta', 'placement', 'planKey', 'packKey'], requiredProperties: ['cta', 'placement'] },
  'storefront.demo_started': { scope: 'marketing', allowedProperties: ['demo'], requiredProperties: ['demo'] },
  'storefront.demo_completed': { scope: 'marketing', allowedProperties: ['demo', 'durationMs'], requiredProperties: ['demo'] },
  'storefront.pricing_viewed': { scope: 'marketing', allowedProperties: [], requiredProperties: [] },
  'storefront.signup_started': { scope: 'marketing', allowedProperties: ['placement'], requiredProperties: [] },
  'storefront.booked_call': { scope: 'marketing', allowedProperties: ['placement'], requiredProperties: [] },
  'storefront.scroll_depth': { scope: 'marketing', allowedProperties: ['percent'], requiredProperties: ['percent'] },
  'storefront.product_tab_engaged': { scope: 'marketing', allowedProperties: ['tab'], requiredProperties: ['tab'] },
  'storefront.roi_completed': { scope: 'marketing', allowedProperties: ['scenario'], requiredProperties: ['scenario'] },
  'storefront.case_study_opened': { scope: 'marketing', allowedProperties: ['caseStudyId'], requiredProperties: ['caseStudyId'] },
  'storefront.integration_page_viewed': { scope: 'marketing', allowedProperties: ['integrationKey'], requiredProperties: ['integrationKey'] },
  'tryon.widget_viewed': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: [] },
  'tryon.opened': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: [] },
  'tryon.photo_selected': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: [] },
  'tryon.photo_uploaded': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: [] },
  'tryon.generation_started': { scope: 'tenant', allowedProperties: ['productId', 'variantId', 'flowId'], requiredProperties: [] },
  'tryon.generation_succeeded': { scope: 'tenant', allowedProperties: ['productId', 'variantId', 'durationMs', 'provider', 'model'], requiredProperties: ['durationMs'] },
  'tryon.generation_failed': { scope: 'tenant', allowedProperties: ['productId', 'variantId', 'durationMs', 'errorCode', 'retryable'], requiredProperties: ['errorCode', 'retryable'] },
  'tryon.result_viewed': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: [] },
  'tryon.product_retried': { scope: 'tenant', allowedProperties: ['productId', 'variantId'], requiredProperties: ['productId'] },
  'tryon.customer_identified': { scope: 'tenant', allowedProperties: ['method'], requiredProperties: ['method'] },
  'tryon.contact_captured': { scope: 'tenant', allowedProperties: ['kind', 'consentRecorded'], requiredProperties: ['kind', 'consentRecorded'] },
  'conversation.received': { scope: 'tenant', allowedProperties: ['inputKind'], requiredProperties: ['inputKind'] },
  'conversation.ai_replied': { scope: 'tenant', allowedProperties: ['durationMs', 'provider', 'model'], requiredProperties: [] },
  'conversation.handoff': { scope: 'tenant', allowedProperties: ['reasonCode', 'humanIntervention'], requiredProperties: ['reasonCode', 'humanIntervention'] },
  'lead.created': { scope: 'tenant', allowedProperties: ['sourceType'], requiredProperties: ['sourceType'] },
  'lead.scored': { scope: 'tenant', allowedProperties: ['scoreBand'], requiredProperties: ['scoreBand'] },
  'lead.routed': { scope: 'tenant', allowedProperties: ['routeType'], requiredProperties: ['routeType'] },
  'workflow.started': { scope: 'tenant', allowedProperties: ['workflowId', 'flowId'], requiredProperties: ['workflowId'] },
  'workflow.completed': { scope: 'tenant', allowedProperties: ['workflowId', 'flowId', 'durationMs', 'resultCode'], requiredProperties: ['workflowId'] },
  'workflow.failed': { scope: 'tenant', allowedProperties: ['workflowId', 'flowId', 'durationMs', 'errorCode', 'retryable'], requiredProperties: ['workflowId', 'errorCode', 'retryable'] },
  'workflow.human_reviewed': { scope: 'tenant', allowedProperties: ['workflowId', 'flowId', 'resultCode'], requiredProperties: ['workflowId', 'resultCode'] },
  'order.add_to_cart': { scope: 'tenant', allowedProperties: ['productId', 'variantId', 'influencedByTryOn'], requiredProperties: ['productId', 'influencedByTryOn'] },
  'order.checkout_started': { scope: 'tenant', allowedProperties: ['influencedByTryOn'], requiredProperties: ['influencedByTryOn'] },
  'order.completed': { scope: 'tenant', allowedProperties: ['attribution'], requiredProperties: ['attribution'] },
  'reporting.report_viewed': { scope: 'tenant', allowedProperties: ['report'], requiredProperties: ['report'] },
  'reporting.export_requested': { scope: 'tenant', allowedProperties: ['report', 'format'], requiredProperties: ['report', 'format'] },
  'integration.connected': { scope: 'tenant', allowedProperties: ['integrationKey'], requiredProperties: ['integrationKey'] },
  'integration.failed': { scope: 'tenant', allowedProperties: ['integrationKey', 'errorCode'], requiredProperties: ['integrationKey', 'errorCode'] },
  'billing.credit_consumed': { scope: 'tenant', allowedProperties: ['product', 'quantity'], requiredProperties: ['product', 'quantity'] },
} as const satisfies { [Name in AnalyticsEventName]: EventDefinition<Name> };
