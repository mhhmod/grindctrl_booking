// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coreCapabilitySecret } from './capability-key';
import { signPreviewTokenForShop, verifyPreviewTokenAnyApp } from '@/lib/launch/preview-token';
import { signOriginToken, verifyOriginTokenAnyApp } from '@/lib/messenger/identity';
import { signTryOnSession, verifyTryOnSession } from '@/lib/try-on/storefront-context';
import { resolveTryOnSessionKey } from '@/lib/try-on/signing-keys';
const CORE='test-only-core-secret-independent-at-least-32-bytes';
const SHOPIFY='test-only-platform-secret-unrelated-to-core-key';
afterEach(() => vi.unstubAllEnvs());
describe('independent core capability key', () => {
  it('does not substitute Shopify secrets for missing core configuration', () => {
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET','');
    vi.stubEnv('SHOPIFY_API_KEY','app-a'); vi.stubEnv('SHOPIFY_API_SECRET',SHOPIFY);
    expect(coreCapabilitySecret()).toBeNull();
    expect(signPreviewTokenForShop('demo.myshopify.com')).toBeNull();
  });
  it('survives reordering/changing platform registrations and rejects platform-signed origin proofs', () => {
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET',CORE);
    const preview=signPreviewTokenForShop('demo.myshopify.com')!;
    vi.stubEnv('SHOPIFY_APPS','[]');
    expect(verifyPreviewTokenAnyApp(preview.token,'demo.myshopify.com')).toBe(true);
    const origin=signOriginToken(CORE,{key:'public_embed_key',origin:'https://demo.example'});
    expect(verifyOriginTokenAnyApp(origin,'public_embed_key')).toBe('https://demo.example');
    expect(verifyOriginTokenAnyApp(signOriginToken(SHOPIFY,{key:'public_embed_key',origin:'https://demo.example'}),'public_embed_key')).toBeNull();
  });
  it('rejects a public-demo token minted with an app secret', () => {
    vi.stubEnv('GRINDCTRL_CAPABILITY_SECRET',CORE);
    vi.stubEnv('SHOPIFY_API_KEY','app-a'); vi.stubEnv('SHOPIFY_API_SECRET',SHOPIFY);
    const platform=signTryOnSession(SHOPIFY,{purpose:'public-demo',productId:'sage-linen-shirt'}).token;
    expect(resolveTryOnSessionKey(key=>verifyTryOnSession(key,platform))).toBeNull();
    const core=signTryOnSession(CORE,{purpose:'public-demo',productId:'sage-linen-shirt'}).token;
    expect(resolveTryOnSessionKey(key=>verifyTryOnSession(key,core))?.value.purpose).toBe('public-demo');
  });
});
