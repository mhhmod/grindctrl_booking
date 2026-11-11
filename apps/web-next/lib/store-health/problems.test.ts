import { describe, expect, it } from 'vitest';
import { healthyFacts } from './test-fixtures';
import { detectStoreProblems, storeHealthEmailsEnabled } from './problems';

describe('store health detection from Store check rows', () => {
  it('ignores well, waiting, preview, attention and unrelated rows', () => {
    const f = healthyFacts();
    expect(detectStoreProblems(f)).toEqual([]);
    expect(detectStoreProblems({ ...f, code: { connected: false, lastSeenAt: null } })).toEqual([]);
    expect(detectStoreProblems({ ...f, launchState: 'preview', codeOutdated: true, tryOn: { ...f.tryOn!, looksLeft: 2 }, health: { ...f.health!, floating: 2 } })).toEqual([]);
    expect(detectStoreProblems({ ...f, tryOn: { ...f.tryOn!, planActive: false, looksLeft: 0 } })).toEqual([]);
    expect(detectStoreProblems({ ...f, tryOn: { ...f.tryOn!, showButton: false, looksLeft: 0 } })).toEqual([]);
  });
  it('reuses A6.5 exactly: at 48 hours is not bad, after 48 hours is one code problem covering chat', () => {
    const f = healthyFacts();
    f.code.lastSeenAt = new Date(f.now - 48 * 3600_000).toISOString();
    expect(detectStoreProblems(f)).toEqual([]);
    f.now++;
    expect(detectStoreProblems(f)).toEqual(['code_gone']);
    f.chat!.enabled = false;
    expect(detectStoreProblems(f)).toEqual(['code_gone']);
  });
  it('maps only the bad looks/details/photos rows to stable problem keys', () => {
    const f = healthyFacts();
    f.tryOn!.looksLeft = 0; f.health!.detected = 0; f.health!.missing = 5; f.health!.photoHost = 'cdn.example';
    expect(detectStoreProblems(f)).toEqual(['tryon_out_of_looks', 'product_details_missing', 'product_photos_blocked']);
    expect(detectStoreProblems({ ...f, platform: 'shopify_app' })).toEqual(['tryon_out_of_looks']);
  });
  it('defaults on in the existing settings JSON; only an explicit opt-out disables it', () => {
    for (const raw of [null, {}, { store_health_notifications: {} }]) expect(storeHealthEmailsEnabled(raw)).toBe(true);
    expect(storeHealthEmailsEnabled({ store_health_notifications: { emailOnFailure: false } })).toBe(false);
  });
});
