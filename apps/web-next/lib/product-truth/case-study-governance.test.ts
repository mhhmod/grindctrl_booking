import { describe, expect, it } from 'vitest';
import {
  evaluateCaseStudyPublication,
  evaluateMetricPublication,
  getPublishableCaseStudies,
  isMetricPublishable,
  PUBLIC_CASE_STUDIES,
  type CaseStudyCandidate,
  type PublicMetricCandidate,
} from './case-study-governance';
import type { PublicTruthRecord } from './public-register';

const NOW = new Date('2026-09-13T12:00:00.000Z');

const publishableTruthRecords: Record<string, PublicTruthRecord> = {
  'metric.test-response-time': {
    id: 'metric.test-response-time',
    kind: 'metric',
    statement: 'Test fixture only.',
    surfaces: ['test'],
    status: 'documented-evidence',
    handling: 'allow',
    sources: [{ path: 'test-fixture' }],
    evidence: [{ id: 'test-metric-evidence', kind: 'test', ref: 'test-fixture', note: 'Test fixture.' }],
    lastReviewedAt: '2026-09-13',
    note: 'Test fixture only; not a customer claim.',
  },
  'case-study.test-merchant': {
    id: 'case-study.test-merchant',
    kind: 'case-study',
    statement: 'Test fixture only.',
    surfaces: ['test'],
    status: 'documented-evidence',
    handling: 'allow',
    sources: [{ path: 'test-fixture' }],
    evidence: [{ id: 'test-case-evidence', kind: 'approval', ref: 'test-fixture', note: 'Test fixture.' }],
    lastReviewedAt: '2026-09-13',
    note: 'Test fixture only; not a customer case study.',
  },
};

const resolveTruthRecord = (id: string): PublicTruthRecord | undefined => publishableTruthRecords[id];

const approvedMetric = {
  id: 'test-response-time',
  truthRecordId: 'metric.test-response-time',
  value: 42,
  source: {
    type: 'analytics-export',
    reference: 'private-evidence/test-export',
    extractedAt: '2026-09-10',
    verifiedAt: '2026-09-12',
    containsCustomerData: true,
  },
  period: { startsOn: '2026-08-01', endsOn: '2026-08-31', timezone: 'Africa/Cairo' },
  scope: {
    description: 'Consented production sessions in the measured period.',
    tenantCount: 1,
    inclusions: ['Completed customer sessions'],
    exclusions: ['Internal, demo and bot traffic'],
  },
  definition: {
    name: 'Median first response time',
    unit: 'seconds',
    aggregation: 'median',
    calculation: 'Median of first AI response timestamp minus customer message timestamp.',
  },
  sample: { size: 12, unit: 'completed sessions' },
  approval: {
    status: 'approved',
    approvedBy: 'test-approver',
    approvedAt: '2026-09-12',
    expiresAt: '2026-10-12',
    customerDataApproval: 'approved',
  },
} as const satisfies PublicMetricCandidate;

const approvedCaseStudy = {
  id: 'test-merchant',
  truthRecordId: 'case-study.test-merchant',
  title: 'Test fixture case study',
  context: { storeType: 'Test store', market: 'Test market', scale: 'Test scale', problem: 'Test problem' },
  before: 'A test-only description of the prior state.',
  implementation: ['Test capability'],
  workflow: ['Test workflow step'],
  measuredOutcomes: [approvedMetric],
  merchantQuote: null,
  technicalFootprint: ['Test integration'],
  approval: {
    status: 'approved',
    approvedBy: 'test-approver',
    approvedAt: '2026-09-12',
    expiresAt: '2026-10-12',
    customerDataApproval: 'approved',
  },
} as const satisfies CaseStudyCandidate;

const options = { now: NOW, resolveTruthRecord } as const;

describe('public metric governance', () => {
  it('accepts a complete, approved metric only when its truth record is independently publishable', () => {
    expect(evaluateMetricPublication(approvedMetric, options)).toEqual({ eligible: true, blockers: [] });
  });

  it.each([
    ['source', { ...approvedMetric, source: null }, 'missing-source'],
    ['period', { ...approvedMetric, period: null }, 'invalid-period'],
    ['scope', { ...approvedMetric, scope: null }, 'missing-scope'],
    ['definition', { ...approvedMetric, definition: null }, 'missing-definition'],
    ['sample', { ...approvedMetric, sample: null }, 'invalid-sample'],
    [
      'expired approval',
      { ...approvedMetric, approval: { ...approvedMetric.approval, expiresAt: '2026-01-01' } },
      'approval-expired',
    ],
  ] as const)('fails closed when %s evidence is incomplete', (_label, candidate, blocker) => {
    expect(evaluateMetricPublication(candidate, options)).toMatchObject({ eligible: false });
    expect(evaluateMetricPublication(candidate, options).blockers).toContain(blocker);
  });

  it('blocks pending publication approval and missing customer permission', () => {
    expect(evaluateMetricPublication({ ...approvedMetric, approval: { status: 'pending' } }, options).blockers)
      .toContain('publication-not-approved');
    expect(evaluateMetricPublication({
      ...approvedMetric,
      approval: { ...approvedMetric.approval, customerDataApproval: 'not-required' },
    }, options).blockers).toContain('customer-approval-required');
  });

  it('does not let approval override the existing unverified public truth register', () => {
    expect(isMetricPublishable({
      ...approvedMetric,
      truthRecordId: 'metric.average-response-1-42-seconds',
    }, { now: NOW })).toBe(false);
  });
});

describe('case-study governance', () => {
  it('does not ship placeholder customer records', () => {
    expect(PUBLIC_CASE_STUDIES).toEqual([]);
    expect(getPublishableCaseStudies()).toEqual([]);
  });

  it('filters incomplete or unapproved case studies instead of exposing empty cards', () => {
    const incomplete = { ...approvedCaseStudy, before: '' };
    const unapproved = { ...approvedCaseStudy, approval: { status: 'pending' } } as const;

    expect(getPublishableCaseStudies([approvedCaseStudy, incomplete, unapproved], options))
      .toEqual([approvedCaseStudy]);
    expect(evaluateCaseStudyPublication(incomplete, options).blockers).toContain('incomplete-case-study');
    expect(evaluateCaseStudyPublication(unapproved, options).blockers).toContain('publication-not-approved');
  });

  it('requires at least one publishable measured outcome', () => {
    const withoutOutcome = { ...approvedCaseStudy, measuredOutcomes: [] };
    const unpublishableOutcome = {
      ...approvedCaseStudy,
      measuredOutcomes: [{ ...approvedMetric, approval: { status: 'revoked' } }],
    } as const;

    expect(evaluateCaseStudyPublication(withoutOutcome, options).blockers).toContain('missing-measured-outcome');
    expect(evaluateCaseStudyPublication(unpublishableOutcome, options).blockers)
      .toContain('unpublishable-measured-outcome');
  });
});
