import { describe, expect, it } from 'vitest';
import {
  findPublicTruthRecord,
  isPublishableWithoutOwnerReview,
  PUBLIC_TRUTH_REGISTER,
} from './public-register';

describe('public truth register', () => {
  it('uses unique stable claim and evidence ids with repository-relative source paths', () => {
    const ids = PUBLIC_TRUTH_REGISTER.map((record) => record.id);
    expect(new Set(ids).size).toBe(ids.length);

    const evidenceIds = PUBLIC_TRUTH_REGISTER.flatMap((record) =>
      record.evidence.map((evidence) => evidence.id),
    );
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);

    for (const record of PUBLIC_TRUTH_REGISTER) {
      expect(record.id).toMatch(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
      expect(record.sources.length).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.path).not.toMatch(/^(?:[A-Za-z]:|[/\\])/);
        expect(source.path).not.toMatch(/(?::\d+|#L\d+)$/);
      }
      for (const evidence of record.evidence) {
        expect(evidence.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
    }
  });

  it('never treats unverified, planned, preview, or approval-gated records as publishable', () => {
    for (const record of PUBLIC_TRUTH_REGISTER) {
      if (['unverified', 'planned', 'preview-mock', 'approval-required'].includes(record.status)) {
        expect(isPublishableWithoutOwnerReview(record), record.id).toBe(false);
      }
    }
  });

  it('requires evidence before a record can be published without owner review', () => {
    const evidenceFree = PUBLIC_TRUTH_REGISTER.filter((record) => record.evidence.length === 0);
    expect(evidenceFree.length).toBeGreaterThan(0);
    expect(evidenceFree.every((record) => !isPublishableWithoutOwnerReview(record))).toBe(true);
  });

  it('keeps the four exposed operational metrics under owner review', () => {
    const metricIds = [
      'metric.messages-handled-12842',
      'metric.leads-captured-342',
      'metric.live-automations-28',
      'metric.average-response-1-42-seconds',
    ];

    for (const id of metricIds) {
      expect(findPublicTruthRecord(id)).toMatchObject({
        status: 'unverified',
        handling: 'owner-review',
      });
    }
  });

  it('keeps preview CRM, workflow, attribution, and testimonials hidden', () => {
    const hiddenIds = [
      'capability.crm-pipeline',
      'capability.workflow-history',
      'capability.connected-attribution',
      'testimonial.verified-customer-quotes',
    ];

    for (const id of hiddenIds) {
      expect(findPublicTruthRecord(id)?.handling).toBe('hide');
    }
  });
});
