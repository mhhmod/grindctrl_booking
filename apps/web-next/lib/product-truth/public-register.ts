export const PUBLIC_RECORD_KINDS = [
  'metric',
  'capability',
  'integration',
  'timing',
  'pricing',
  'privacy',
  'security',
  'testimonial',
  'case-study',
  'outcome',
  'workflow',
  'language',
  'service',
] as const;

export type PublicRecordKind = (typeof PUBLIC_RECORD_KINDS)[number];

export const EVIDENCE_STATUSES = [
  'verified-in-source',
  'documented-evidence',
  'unverified',
  'planned',
  'preview-mock',
  'approval-required',
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const PUBLIC_HANDLINGS = ['allow', 'qualify', 'hide', 'owner-review'] as const;
export type PublicHandling = (typeof PUBLIC_HANDLINGS)[number];

export type SourceReference = {
  path: string;
};

export type EvidenceReference = {
  id: string;
  kind: 'code' | 'test' | 'checkpoint' | 'live' | 'approval';
  ref: string;
  note: string;
};

export type PublicTruthRecord = {
  id: string;
  kind: PublicRecordKind;
  statement: string;
  surfaces: readonly string[];
  status: EvidenceStatus;
  handling: PublicHandling;
  sources: readonly SourceReference[];
  evidence: readonly EvidenceReference[];
  lastReviewedAt: string;
  note: string;
};

const REVIEW_DATE = '2026-09-13';

/**
 * Initial Phase 0 register of material public claims and capabilities.
 *
 * This file records evidence state; it does not itself authorize publication.
 * `verified-in-source` proves that code implements a behavior, not that the
 * behavior is deployed, commercially approved, or producing customer outcomes.
 */
export const PUBLIC_TRUTH_REGISTER = [
  {
    id: 'positioning.managed-ai-systems',
    kind: 'service',
    statement: 'AI systems for online stores, built and run for you.',
    surfaces: ['landing.hero'],
    status: 'approval-required',
    handling: 'qualify',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Strategic positioning needs an approved definition of what GrindCTRL operates for each package.',
  },
  {
    id: 'capability.shopify-tryon',
    kind: 'capability',
    statement: 'Virtual try-on is available on Shopify product and collection surfaces.',
    surfaces: ['landing.hero', 'try-on', 'shopify.theme-extension'],
    status: 'documented-evidence',
    handling: 'allow',
    sources: [
      { path: 'apps/web-next/lib/landing/landing-i18n.ts' },
      { path: 'apps/grindctrl-tryon/extensions/tryon-block/blocks/tryon.liquid' },
      { path: 'apps/grindctrl-tryon/extensions/tryon-block/blocks/tryon-catalog.liquid' },
    ],
    evidence: [
      {
        id: 'shopify-theme-extension-source',
        kind: 'code',
        ref: 'apps/grindctrl-tryon/extensions/tryon-block',
        note: 'Shopify theme blocks and embedded try-on route exist in source.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Deployment availability and per-theme compatibility remain separate evidence questions.',
  },
  {
    id: 'capability.english-arabic',
    kind: 'language',
    statement: 'Customer-facing experiences support English and Arabic.',
    surfaces: ['landing', 'try-on', 'dashboard', 'store-chat'],
    status: 'documented-evidence',
    handling: 'qualify',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [
      {
        id: 'locale-dictionary-parity-tests',
        kind: 'test',
        ref: 'apps/web-next/lib/landing/landing-i18n.test.ts',
        note: 'Locale dictionaries and parity checks exist; not every surface is complete.',
      },
      {
        id: 'mobile-signin-browser-checkpoint',
        kind: 'checkpoint',
        ref: 'docs/superpowers/checkpoints/2026-09-05-mobile-signin-ui.md',
        note: 'Dated narrow-width EN/AR browser evidence exists for the landing/auth header.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Qualify until the remaining English-only dashboard and empty states are closed.',
  },
  {
    id: 'service.managed-setup',
    kind: 'service',
    statement: 'Managed setup is included or available.',
    surfaces: ['landing.hero', 'pricing'],
    status: 'approval-required',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Requires package-specific scope, owner, activation process and service-boundary approval.',
  },
  {
    id: 'timing.tryon-about-nine-seconds',
    kind: 'timing',
    statement: 'A try-on preview takes about 9 seconds.',
    surfaces: ['landing.demo'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs current GrindCTRL percentile data, sample size, provider/model and measurement window.',
  },
  {
    id: 'privacy.tryon-short-private-flow',
    kind: 'privacy',
    statement: 'Photo upload occurs in a short, private flow.',
    surfaces: ['landing.how-it-works', 'try-on.upload'],
    status: 'verified-in-source',
    handling: 'qualify',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [
      {
        id: 'private-result-persistence-source',
        kind: 'code',
        ref: 'apps/web-next/lib/try-on/persistence.ts',
        note: 'Private result storage and bounded signed-result access are implemented in source.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Provider retention, training, backups and deletion-request behavior still require explicit policy evidence.',
  },
  {
    id: 'metric.messages-handled-12842',
    kind: 'metric',
    statement: '12,842 messages handled.',
    surfaces: ['landing.automation-proof'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/landing/automations-showcase.tsx' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs dataset, tenant scope, time window, counting rule and publication approval.',
  },
  {
    id: 'metric.leads-captured-342',
    kind: 'metric',
    statement: '342 leads captured.',
    surfaces: ['landing.automation-proof'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/landing/automations-showcase.tsx' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs dataset, deduplication definition, time window and publication approval.',
  },
  {
    id: 'metric.live-automations-28',
    kind: 'metric',
    statement: '28 automations are live.',
    surfaces: ['landing.automation-proof'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/landing/automations-showcase.tsx' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs a definition of live, owner/source inventory and current verification date.',
  },
  {
    id: 'metric.average-response-1-42-seconds',
    kind: 'metric',
    statement: 'Average response time is 1.42 seconds.',
    surfaces: ['landing.automation-proof'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/landing/automations-showcase.tsx' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs event boundaries, percentile/average definition, sample and measurement window.',
  },
  {
    id: 'proof.automation-screens-real-account',
    kind: 'outcome',
    statement: 'The automation screenshots and statistics come from a real active GrindCTRL account.',
    surfaces: ['landing.automation-proof'],
    status: 'approval-required',
    handling: 'owner-review',
    sources: [
      { path: 'apps/web-next/components/landing/automations-showcase.tsx' },
      { path: 'apps/web-next/lib/landing/landing-i18n.ts' },
    ],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'A source comment is not customer approval, provenance, or permission to publish operational data.',
  },
  {
    id: 'workflow.automation-qualifiers',
    kind: 'workflow',
    statement: 'Shown automations run unattended, handle real customer conversations and issue reports automatically.',
    surfaces: ['landing.automation-proof'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Each qualifier needs workflow-specific evidence and a current operating window.',
  },
  {
    id: 'integration.public-logo-strip',
    kind: 'integration',
    statement: 'Shopify, WhatsApp, Instagram, Telegram, Zapier, Make, n8n, Notion, HubSpot and Supabase are associated with GrindCTRL.',
    surfaces: ['landing.collaborations'],
    status: 'unverified',
    handling: 'qualify',
    sources: [
      { path: 'apps/web-next/components/landing/collaborations-marquee.tsx' },
    ],
    evidence: [
      {
        id: 'integration-catalog-source',
        kind: 'code',
        ref: 'apps/web-next/lib/dashboard/integration-catalog.ts',
        note: 'The internal catalogue distinguishes planned, credential-dependent and implementation-available states.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Render integration depth; a logo alone must not imply native or production-ready support.',
  },
  {
    id: 'capability.storefront-messenger',
    kind: 'capability',
    statement: 'A configurable storefront chat experience is implemented.',
    surfaces: ['shopify.theme-extension', 'embed.messenger'],
    status: 'documented-evidence',
    handling: 'allow',
    sources: [{ path: 'apps/grindctrl-tryon/extensions/tryon-block/blocks/messenger.liquid' }],
    evidence: [
      {
        id: 'storefront-messenger-api-source',
        kind: 'code',
        ref: 'apps/web-next/app/api/messenger',
        note: 'Bootstrap, send, sync, attachment, feedback and configuration routes exist.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Do not broaden this into verified WhatsApp, Instagram or omnichannel operation.',
  },
  {
    id: 'capability.crm-pipeline',
    kind: 'capability',
    statement: 'CRM scoring, routing and pipeline behavior are available.',
    surfaces: ['landing.operations', 'dashboard.crm'],
    status: 'preview-mock',
    handling: 'hide',
    sources: [{ path: 'apps/web-next/lib/dashboard/lead-preview-data.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Lead storage exists, but the current CRM pipeline presentation includes preview data and does not prove external synchronization.',
  },
  {
    id: 'capability.workflow-history',
    kind: 'workflow',
    statement: 'Durable generalized automation execution history and outcomes are available.',
    surfaces: ['dashboard.workflows', 'landing.operations'],
    status: 'preview-mock',
    handling: 'hide',
    sources: [{ path: 'apps/web-next/lib/dashboard/workflow-catalog.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Current workflow catalogue/history does not establish a production execution platform.',
  },
  {
    id: 'capability.connected-attribution',
    kind: 'outcome',
    statement: 'GrindCTRL attributes try-on and customer-journey activity to orders and revenue.',
    surfaces: ['dashboard.analytics', 'landing.reporting'],
    status: 'planned',
    handling: 'hide',
    sources: [{ path: 'apps/web-next/lib/dashboard/analytics-preview-data.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Define direct, assisted and influenced attribution before publishing revenue outcomes.',
  },
  {
    id: 'pricing.failed-generations-refunded',
    kind: 'pricing',
    statement: 'Failed generations are refunded automatically; customers pay only for delivered images.',
    surfaces: ['pricing.plans', 'pricing.faq'],
    status: 'documented-evidence',
    handling: 'qualify',
    sources: [{ path: 'apps/web-next/components/pricing/pricing-copy.ts' }],
    evidence: [
      {
        id: 'credit-refund-tests',
        kind: 'test',
        ref: 'apps/web-next/lib/try-on/entitlement.test.ts',
        note: 'Credit reservation/finalization/refund behavior has source-level tests.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'A refund does not prove the upstream provider call incurred no cost.',
  },
  {
    id: 'pricing.topups-valid-365-days',
    kind: 'pricing',
    statement: 'One-time top-up packs work with active plans and remain valid for 365 days.',
    surfaces: ['pricing.packs'],
    status: 'approval-required',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/pricing/pricing-copy.ts' }],
    evidence: [
      {
        id: 'fallback-pack-validity-source',
        kind: 'code',
        ref: 'apps/web-next/lib/try-on/public-catalog.ts',
        note: 'The fallback pack catalogue encodes a 365-day validity value.',
      },
    ],
    lastReviewedAt: REVIEW_DATE,
    note: 'Code configuration does not replace commercial approval or proof of the active catalogue.',
  },
  {
    id: 'pricing.manual-payment-same-day-activation',
    kind: 'pricing',
    statement: 'Bank transfer, Instapay or Vodafone Cash payment is activated the same day.',
    surfaces: ['pricing.faq'],
    status: 'approval-required',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/pricing/pricing-copy.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Requires approved payment verification procedure, operating hours, responsible operator and service level.',
  },
  {
    id: 'pricing.month-to-month-no-contract',
    kind: 'pricing',
    statement: 'Plans are month to month with no long-term contract.',
    surfaces: ['pricing.faq'],
    status: 'approval-required',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/pricing/pricing-copy.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Commercial/legal term requiring owner approval and alignment with actual customer agreements.',
  },
  {
    id: 'pricing.competitor-entry-volume',
    kind: 'pricing',
    statement: 'Other Shopify try-on entry plans typically include 100 to 150 try-ons per month.',
    surfaces: ['pricing.market-position'],
    status: 'unverified',
    handling: 'owner-review',
    sources: [{ path: 'apps/web-next/components/pricing/pricing-copy.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'Needs dated competitor sources, a comparison methodology and periodic re-verification.',
  },
  {
    id: 'testimonial.verified-customer-quotes',
    kind: 'testimonial',
    statement: 'Verified customer testimonials are available for publication.',
    surfaces: ['landing.testimonials'],
    status: 'planned',
    handling: 'hide',
    sources: [{ path: 'apps/web-next/lib/landing/landing-i18n.ts' }],
    evidence: [],
    lastReviewedAt: REVIEW_DATE,
    note: 'The current empty testimonial collection and hidden section are the correct behavior.',
  },
] as const satisfies readonly PublicTruthRecord[];

export function findPublicTruthRecord(id: string): PublicTruthRecord | undefined {
  return PUBLIC_TRUTH_REGISTER.find((record) => record.id === id);
}

export function isPublishableWithoutOwnerReview(record: PublicTruthRecord): boolean {
  if (record.handling !== 'allow' && record.handling !== 'qualify') return false;
  if (record.status !== 'verified-in-source' && record.status !== 'documented-evidence') return false;
  return record.evidence.length > 0;
}
