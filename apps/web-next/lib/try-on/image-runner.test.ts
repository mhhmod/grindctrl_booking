import { describe, expect, it } from 'vitest';
import { parsePhotoDataUrl } from './image-runner';
import { checkRateLimit, sweepRateLimits } from './rate-limit';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('parsePhotoDataUrl', () => {
  it('accepts a valid png data URL', () => {
    const parsed = parsePhotoDataUrl(PNG_1PX);
    expect(parsed).not.toBeNull();
    expect(parsed?.mime).toBe('image/png');
  });

  it('rejects non-image and malformed payloads', () => {
    expect(parsePhotoDataUrl('data:text/html;base64,PGI+aGk8L2I+')).toBeNull();
    expect(parsePhotoDataUrl('data:image/heic;base64,AAAA')).toBeNull();
    expect(parsePhotoDataUrl('not-a-data-url')).toBeNull();
    expect(parsePhotoDataUrl('data:image/png;base64,')).toBeNull();
  });
});

describe('checkRateLimit', () => {
  it('allows up to the window cap then blocks with retry hint', () => {
    const ip = `test-ip-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip).ok).toBe(true);
    }
    const blocked = checkRateLimit(ip);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    sweepRateLimits(Date.now() + 11 * 60 * 1000);
  });
});
