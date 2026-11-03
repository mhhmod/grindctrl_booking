import { describe, expect, it } from 'vitest';
import { legacyStoreChatHref } from './store-chat-legacy-tab';

const SITE = '11111111-1111-4111-8111-111111111111';

describe('legacyStoreChatHref', () => {
  it.each([
    ['overview', '/dashboard/store-chat'],
    ['ai', '/dashboard/store-chat'],
    ['appearance', '/dashboard/store-chat/setup'],
    ['behaviour', '/dashboard/store-chat/setup'],
    ['installation', '/dashboard/store-chat/setup'],
    ['conversations', '/dashboard/inbox'],
  ])('sends ?tab=%s to %s', (tab, href) => {
    expect(legacyStoreChatHref({ tab })).toBe(href);
  });

  it('keeps the store the link names', () => {
    expect(legacyStoreChatHref({ site: SITE, tab: 'conversations' })).toBe(`/dashboard/inbox?site=${SITE}`);
    expect(legacyStoreChatHref({ site: SITE, tab: 'ai' })).toBe(`/dashboard/store-chat?site=${SITE}`);
  });

  it('sends Shopify’s order access return to the editor that grants it', () => {
    expect(legacyStoreChatHref({ tab: 'behaviour', orders: 'connected' })).toBe(
      '/dashboard/store-chat/setup/more?section=behaviour&orders=connected',
    );
    expect(legacyStoreChatHref({ site: SITE, tab: 'behaviour', orders: 'failed' })).toBe(
      `/dashboard/store-chat/setup/more?site=${SITE}&section=behaviour&orders=failed`,
    );
  });

  it('leaves a link without a known tab alone, so a v16 address never loops', () => {
    expect(legacyStoreChatHref({})).toBeNull();
    expect(legacyStoreChatHref({ site: SITE })).toBeNull();
    expect(legacyStoreChatHref({ tab: 'nope' })).toBeNull();
    expect(legacyStoreChatHref({ tab: 'constructor' })).toBeNull();
    expect(legacyStoreChatHref({ tab: ['ai', 'behaviour'] })).toBeNull();
  });
});
