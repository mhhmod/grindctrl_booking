import {
  findPublicTruthRecord,
  isPublishableWithoutOwnerReview,
  type PublicTruthRecord,
} from './public-register';

export const METRIC_SOURCE_TYPES = [
  'analytics-export',
  'customer-report',
  'contract',
  'technical-log',
] as const;

export type MetricSourceType = (typeof METRIC_SOURCE_TYPES)[number];

export type MetricSource = Readonly<{
  type: MetricSourceType;
  reference: string;
  extractedAt: string;
  verifiedAt: string;
  containsCustomerData: boolean;
}>;

export type MeasurementPeriod = Readonly<{
  startsOn: string;
  endsOn: string;
  timezone: string;
}>;

export type MeasurementScope = Readonly<{
  description: string;
  tenantCount: number;
  inclusions: readonly string[];
  exclusions: readonly string[];
}>;

export type MetricDefinition = Readonly<{
  name: string;
  unit: string;
  aggregation: 'count' | 'average' | 'median' | 'percentage' | 'rate' | 'sum';
  calculation: string;
}>;

export type MetricSample = Readonly<{
  size: number;
  unit: string;
}>;

export type ApprovedPublication = Readonly<{
  status: 'approved';
  approvedBy: string;
  approvedAt: string;
  expiresAt: string | null;
  customerDataApproval: 'approved' | 'not-required';
}>;

export type UnapprovedPublication = Readonly<{
  status: 'pending' | 'rejected' | 'revoked';
}>;

export type PublicationApproval = ApprovedPublication | UnapprovedPublication;

export type PublicMetricCandidate = Readonly<{
  id: string;
  truthRecordId: string;
  value: number;
  source: MetricSource | null;
  period: MeasurementPeriod | null;
  scope: MeasurementScope | null;
  definition: MetricDefinition | null;
  sample: MetricSample | null;
  approval: PublicationApproval;
}>;

export type MerchantQuote = Readonly<{
  text: string;
  attribution: string;
}>;

export type CaseStudyCandidate = Readonly<{
  id: string;
  truthRecordId: string;
  title: string;
  context: Readonly<{
    storeType: string;
    market: string;
    scale: string;
    problem: string;
  }>;
  before: string;
  implementation: readonly string[];
  workflow: readonly string[];
  measuredOutcomes: readonly PublicMetricCandidate[];
  merchantQuote: MerchantQuote | null;
  technicalFootprint: readonly string[];
  approval: PublicationApproval;
}>;

export const PUBLICATION_BLOCKERS = [
  'missing-truth-record',
  'wrong-truth-record-kind',
  'truth-record-not-publishable',
  'invalid-value',
  'missing-source',
  'invalid-period',
  'missing-scope',
  'missing-definition',
  'invalid-sample',
  'publication-not-approved',
  'approval-expired',
  'customer-approval-required',
  'incomplete-case-study',
  'missing-measured-outcome',
  'unpublishable-measured-outcome',
] as const;

export type PublicationBlocker = (typeof PUBLICATION_BLOCKERS)[number];

export type PublicationDecision =
  | Readonly<{ eligible: true; blockers: readonly [] }>
  | Readonly<{ eligible: false; blockers: readonly PublicationBlocker[] }>;

export type PublicationEvaluationOptions = Readonly<{
  now?: Date;
  resolveTruthRecord?: (id: string) => PublicTruthRecord | undefined;
}>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function hasNonEmptyItems(values: readonly string[]): boolean {
  return values.length > 0 && values.every(isNonEmpty);
}

function evaluateApproval(
  approval: PublicationApproval,
  containsCustomerData: boolean,
  now: Date,
): PublicationBlocker[] {
  if (approval.status !== 'approved') return ['publication-not-approved'];

  const blockers: PublicationBlocker[] = [];
  if (!isNonEmpty(approval.approvedBy) || !isIsoDate(approval.approvedAt)) {
    blockers.push('publication-not-approved');
  }
  if (approval.expiresAt !== null) {
    if (!isIsoDate(approval.expiresAt) || new Date(`${approval.expiresAt}T23:59:59.999Z`) < now) {
      blockers.push('approval-expired');
    }
  }
  if (containsCustomerData && approval.customerDataApproval !== 'approved') {
    blockers.push('customer-approval-required');
  }
  return blockers;
}

function evaluateTruthRecord(
  id: string,
  expectedKinds: readonly PublicTruthRecord['kind'][],
  resolveTruthRecord: (id: string) => PublicTruthRecord | undefined,
): PublicationBlocker[] {
  const record = resolveTruthRecord(id);
  if (!record) return ['missing-truth-record'];
  if (!expectedKinds.includes(record.kind)) return ['wrong-truth-record-kind'];
  if (!isPublishableWithoutOwnerReview(record)) return ['truth-record-not-publishable'];
  return [];
}

function decision(blockers: readonly PublicationBlocker[]): PublicationDecision {
  const unique = [...new Set(blockers)];
  return unique.length === 0
    ? { eligible: true, blockers: [] }
    : { eligible: false, blockers: unique };
}

export function evaluateMetricPublication(
  metric: PublicMetricCandidate,
  options: PublicationEvaluationOptions = {},
): PublicationDecision {
  const now = options.now ?? new Date();
  const resolveTruthRecord = options.resolveTruthRecord ?? findPublicTruthRecord;
  const blockers: PublicationBlocker[] = [
    ...evaluateTruthRecord(metric.truthRecordId, ['metric', 'outcome'], resolveTruthRecord),
  ];

  if (!Number.isFinite(metric.value)) blockers.push('invalid-value');

  if (
    !metric.source
    || !isNonEmpty(metric.source.reference)
    || !isIsoDate(metric.source.extractedAt)
    || !isIsoDate(metric.source.verifiedAt)
  ) {
    blockers.push('missing-source');
  }

  if (
    !metric.period
    || !isIsoDate(metric.period.startsOn)
    || !isIsoDate(metric.period.endsOn)
    || metric.period.startsOn > metric.period.endsOn
    || !isNonEmpty(metric.period.timezone)
  ) {
    blockers.push('invalid-period');
  }

  if (
    !metric.scope
    || !isNonEmpty(metric.scope.description)
    || !Number.isInteger(metric.scope.tenantCount)
    || metric.scope.tenantCount < 1
    || !hasNonEmptyItems(metric.scope.inclusions)
  ) {
    blockers.push('missing-scope');
  }

  if (
    !metric.definition
    || !isNonEmpty(metric.definition.name)
    || !isNonEmpty(metric.definition.unit)
    || !isNonEmpty(metric.definition.calculation)
  ) {
    blockers.push('missing-definition');
  }

  if (!metric.sample || !Number.isInteger(metric.sample.size) || metric.sample.size < 1 || !isNonEmpty(metric.sample.unit)) {
    blockers.push('invalid-sample');
  }

  blockers.push(...evaluateApproval(
    metric.approval,
    metric.source?.containsCustomerData ?? true,
    now,
  ));

  return decision(blockers);
}

export function isMetricPublishable(
  metric: PublicMetricCandidate,
  options: PublicationEvaluationOptions = {},
): boolean {
  return evaluateMetricPublication(metric, options).eligible;
}

export function evaluateCaseStudyPublication(
  caseStudy: CaseStudyCandidate,
  options: PublicationEvaluationOptions = {},
): PublicationDecision {
  const now = options.now ?? new Date();
  const resolveTruthRecord = options.resolveTruthRecord ?? findPublicTruthRecord;
  const blockers: PublicationBlocker[] = [
    ...evaluateTruthRecord(caseStudy.truthRecordId, ['case-study'], resolveTruthRecord),
  ];

  if (
    !isNonEmpty(caseStudy.id)
    || !isNonEmpty(caseStudy.title)
    || !isNonEmpty(caseStudy.context.storeType)
    || !isNonEmpty(caseStudy.context.market)
    || !isNonEmpty(caseStudy.context.scale)
    || !isNonEmpty(caseStudy.context.problem)
    || !isNonEmpty(caseStudy.before)
    || !hasNonEmptyItems(caseStudy.implementation)
    || !hasNonEmptyItems(caseStudy.workflow)
    || !hasNonEmptyItems(caseStudy.technicalFootprint)
    || (caseStudy.merchantQuote !== null
      && (!isNonEmpty(caseStudy.merchantQuote.text) || !isNonEmpty(caseStudy.merchantQuote.attribution)))
  ) {
    blockers.push('incomplete-case-study');
  }

  if (caseStudy.measuredOutcomes.length === 0) {
    blockers.push('missing-measured-outcome');
  } else if (caseStudy.measuredOutcomes.some((metric) => !isMetricPublishable(metric, { now, resolveTruthRecord }))) {
    blockers.push('unpublishable-measured-outcome');
  }

  blockers.push(...evaluateApproval(caseStudy.approval, true, now));
  return decision(blockers);
}

export function isCaseStudyPublishable(
  caseStudy: CaseStudyCandidate,
  options: PublicationEvaluationOptions = {},
): boolean {
  return evaluateCaseStudyPublication(caseStudy, options).eligible;
}

/**
 * No customer case study is currently evidenced and approved for publication.
 * Add records only after the private evidence pack and truth register are updated.
 */
export const PUBLIC_CASE_STUDIES = [] as const satisfies readonly CaseStudyCandidate[];

export function getPublishableCaseStudies(
  candidates: readonly CaseStudyCandidate[] = PUBLIC_CASE_STUDIES,
  options: PublicationEvaluationOptions = {},
): readonly CaseStudyCandidate[] {
  return candidates.filter((candidate) => isCaseStudyPublishable(candidate, options));
}
