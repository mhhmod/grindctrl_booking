import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLandingPreviewHandoff,
  LANDING_PREVIEW_STORAGE_KEY,
  readLandingPreviewHandoff,
  saveLandingPreviewHandoff,
} from '@/lib/trial/landing-preview-handoff';

describe('landing preview handoff storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('saves and reads a valid preview handoff payload', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'workflow',
      workflowSlug: 'workflow_planner',
      summary: 'Support and leads workflow mapped.',
      confidence: 91,
      extractedEntities: { owner: 'support_ops', signal_count: 3 },
      decision: {
        route: 'support_and_ops_routing',
        priority: 'medium',
        handoffRequired: false,
      },
      recommendedAction: 'Start a 14-day trial to save and deploy.',
    });

    const stored = readLandingPreviewHandoff();
    expect(stored).not.toBeNull();
    expect(stored?.workflowSlug).toBe('workflow_planner');
    expect(stored?.mode).toBe('workflow');
    expect(stored?.decision.priority).toBe('medium');
    expect(typeof stored?.createdAt).toBe('string');
  });

  it('returns null and clears malformed payload', () => {
    window.localStorage.setItem(LANDING_PREVIEW_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

    const stored = readLandingPreviewHandoff();
    expect(stored).toBeNull();
    expect(window.localStorage.getItem(LANDING_PREVIEW_STORAGE_KEY)).toBeNull();
  });

  it('clear removes stored preview handoff', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'voice',
      workflowSlug: 'voice_lead_capture',
      summary: 'Voice lead mapped.',
      confidence: 88,
      extractedEntities: { company: 'Bright Dental' },
      decision: {
        route: 'lead_capture',
        priority: 'high',
        handoffRequired: true,
      },
      recommendedAction: 'Start a 14-day trial to unlock full workflow.',
    });

    clearLandingPreviewHandoff();
    expect(readLandingPreviewHandoff()).toBeNull();
  });

  it('does not persist file binary or raw transcript-like fields', () => {
    saveLandingPreviewHandoff({
      source: 'landing_sandbox',
      mode: 'file',
      workflowSlug: 'file_image_intake',
      summary: 'Invoice intake mapped.',
      confidence: 84,
      extractedEntities: {
        route_hint: 'finance_ops',
        transcript_raw: 'full raw transcript text should not persist',
        file_blob: 'data:application/octet-stream;base64,AAAA',
        file_name: 'invoice-april-2026.pdf',
      },
      decision: {
        route: 'intake_triage',
        priority: 'medium',
        handoffRequired: false,
      },
      recommendedAction: 'Start a 14-day trial.',
    });

    const stored = readLandingPreviewHandoff();
    expect(stored?.extractedEntities.route_hint).toBe('finance_ops');
    expect(stored?.extractedEntities.file_name).toBe('invoice-april-2026.pdf');
    expect(stored?.extractedEntities).not.toHaveProperty('transcript_raw');
    expect(stored?.extractedEntities).not.toHaveProperty('file_blob');
  });

  it('returns null if localStorage read throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage_unavailable');
    });

    expect(readLandingPreviewHandoff()).toBeNull();
  });
});
