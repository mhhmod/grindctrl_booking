import { describe, expect, it } from 'vitest';
import { androidIntentUrl, detectInAppBrowser, storePageUrl } from './in-app-browser';

const IG_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; ar_EG)';
const IG_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0 Mobile Safari/537.36 Instagram 339.0.0.37.93 Android';
const FB_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.103;FBBV/1;FBDV/iPhone15,2]';
const TIKTOK_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 musical_ly_2023405030 JsSdk/1.0 NetType/WIFI BytedanceWebview/d8a21c6';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('in-app browsers', () => {
  it('names the app the shopper is in, and the phone', () => {
    expect(detectInAppBrowser(IG_IOS)).toEqual({ app: 'Instagram', os: 'ios' });
    expect(detectInAppBrowser(IG_ANDROID)).toEqual({ app: 'Instagram', os: 'android' });
    expect(detectInAppBrowser(FB_IOS)).toEqual({ app: 'Facebook', os: 'ios' });
    expect(detectInAppBrowser(TIKTOK_ANDROID)).toEqual({ app: 'TikTok', os: 'android' });
  });

  it("leaves the phone's own browser alone", () => {
    expect(detectInAppBrowser(SAFARI)).toBeNull();
    expect(detectInAppBrowser('')).toBeNull();
  });

  it("links to the store's own page for the piece and variant, which reopens the try-on", () => {
    expect(storePageUrl({ referrer: 'https://maisonnoor.com/', shop: 'maison.myshopify.com', handle: 'layla-abaya', variantId: '456' })).toBe(
      'https://maisonnoor.com/products/layla-abaya?variant=456&gc_tryon=1',
    );
    // Arabic handles work (item 29).
    expect(storePageUrl({ referrer: 'https://maisonnoor.com/', handle: 'عباية-ليلى' })).toBe(
      'https://maisonnoor.com/products/%D8%B9%D8%A8%D8%A7%D9%8A%D8%A9-%D9%84%D9%8A%D9%84%D9%89?gc_tryon=1',
    );
  });

  it('falls back to the shop domain, and refuses what it cannot trust', () => {
    expect(storePageUrl({ referrer: '', shop: 'maison.myshopify.com', handle: 'layla-abaya' })).toBe(
      'https://maison.myshopify.com/products/layla-abaya?gc_tryon=1',
    );
    expect(storePageUrl({ referrer: 'http://maisonnoor.com/', shop: 'evil.com', handle: 'layla-abaya' })).toBeNull();
    expect(storePageUrl({ referrer: 'https://maisonnoor.com/', handle: '../admin' })).toBeNull();
    expect(storePageUrl({ referrer: 'https://maisonnoor.com/', handle: 'layla-abaya', variantId: '1;2' })).toBe(
      'https://maisonnoor.com/products/layla-abaya?gc_tryon=1',
    );
  });

  it('opens Chrome on Android, with the plain link to fall back on', () => {
    expect(androidIntentUrl('https://maisonnoor.com/products/layla-abaya?variant=456&gc_tryon=1')).toBe(
      'intent://maisonnoor.com/products/layla-abaya?variant=456&gc_tryon=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fmaisonnoor.com%2Fproducts%2Flayla-abaya%3Fvariant%3D456%26gc_tryon%3D1;end',
    );
  });
});
