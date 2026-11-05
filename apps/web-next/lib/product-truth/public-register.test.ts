import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findPublicTruthRecord,
  isPublishableWithoutOwnerReview,
  PUBLIC_TRUTH_REGISTER,
} from './public-register';

const REPO_ROOT = join(__dirname, '../../../..');

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

  it('points every source and every code, test or checkpoint reference at a file that exists', () => {
    // A record that names a deleted file looks evidenced while proving nothing.
    const missing: string[] = [];
    for (const record of PUBLIC_TRUTH_REGISTER) {
      for (const source of record.sources) {
        if (!existsSync(join(REPO_ROOT, source.path))) missing.push(`${record.id} source ${source.path}`);
      }
      for (const evidence of record.evidence) {
        if (['code', 'test', 'checkpoint'].includes(evidence.kind) && !existsSync(join(REPO_ROOT, evidence.ref))) {
          missing.push(`${record.id} evidence ${evidence.ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('records the platform presentation as a qualified claim backed by the readiness matrix', () => {
    const record = findPublicTruthRecord('integration.public-logo-strip');
    expect(record).toMatchObject({ handling: 'qualify', status: 'documented-evidence' });
    expect(record?.statement).toMatch(/Shopify is live/);
    expect(record?.statement).toMatch(/WooCommerce is live for Try-On, Store Chat and order status/);
    expect(record?.statement).toMatch(/Your own website is live for Store Chat only/);
    expect(record?.statement).toMatch(/Salla and Zid are planned/);
    expect(record?.evidence.map((evidence) => evidence.ref)).toContain('docs/platform-readiness-matrix.md');
    expect(record?.evidence.map((evidence) => evidence.ref)).toContain(
      'docs/superpowers/checkpoints/2026-11-04-woocommerce-live.md',
    );
    expect(record?.evidence.map((evidence) => evidence.ref)).toContain(
      'docs/superpowers/checkpoints/2026-11-05-woocommerce-parity-live.md',
    );
    expect(record?.statement).not.toMatch(/marketplace|supported everywhere|all stores/i);
    expect(record?.note).not.toMatch(/Shopify-only/);
  });
});
