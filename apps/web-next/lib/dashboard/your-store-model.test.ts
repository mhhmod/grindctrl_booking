import { describe, expect, it } from 'vitest';
import { getYourStoreCopy } from './your-store-copy';
import {
  buildTodayStoreCard,
  buildYourStoreView,
  CODE_STALE_AFTER_MS,
  domainLineState,
  INSTALL_HREF,
  PLAN_HREF,
  type YourStoreFacts,
} from './your-store-model';

const NOW = Date.parse('2026-11-10T12:14:00Z');
const HOUR = 3_600_000;
const en = getYourStoreCopy('en');
const ar = getYourStoreCopy('ar');

function facts(overrides: Partial<YourStoreFacts> = {}): YourStoreFacts {
  return {
    now: NOW,
    timeZone: 'UTC',
    platform: 'paste_website',
    address: 'lulusfashion.com',
    storeUrl: 'https://lulusfashion.com',
    canChange: true,
    canBilling: true,
    code: { lastSeenAt: new Date(NOW - 3 * 60_000).toISOString(), connected: false },
    launchState: 'live',
    codeOutdated: false,
    tryOn: { tenant: 'site:1', showButton: true, looksLeft: 15, looksIncluded: 20, planActive: true, pasteReason: null },
    chat: { siteId: 'site-1', enabled: true },
    domains: [],
    ...overrides,
  };
}

const tryOn = (overrides: Partial<NonNullable<YourStoreFacts['tryOn']>> = {}) => ({ ...facts().tryOn!, ...overrides });
const product = (view: ReturnType<typeof buildYourStoreView>, key: 'tryOn' | 'storeChat') =>
  view.products.find((p) => p.key === key)!;

describe('buildYourStoreView, product cards', () => {
  it('lays the products out as a list, Try-On then Store Chat', () => {
    expect(buildYourStoreView(facts(), en, 'en').products.map((p) => p.key)).toEqual(['tryOn', 'storeChat']);
  });

  it('shows no pill and the quiet sentence while a product is off', () => {
    const view = buildYourStoreView(facts({ tryOn: tryOn({ showButton: false }), chat: { siteId: 'site-1', enabled: false } }), en, 'en');
    for (const key of ['tryOn', 'storeChat'] as const) {
      expect(product(view, key)).toMatchObject({ on: false, pill: null, sentenceQuiet: true, looks: null, seeIt: null });
    }
    expect(product(view, 'tryOn').sentence).toBe('Shoppers see a Try-On button on your product pages.');
  });

  it('switches the heading from Turn on what you want to On your store once any switch is on', () => {
    const off = facts({ tryOn: tryOn({ showButton: false }), chat: { siteId: 'site-1', enabled: false } });
    expect(buildYourStoreView(off, en, 'en').heading).toBe('Turn on what you want');
    expect(buildYourStoreView({ ...off, chat: { siteId: 'site-1', enabled: true } }, en, 'en').heading).toBe('On your store');
    expect(buildYourStoreView(off, ar, 'ar').heading).toBe('شغّل ما تريد');
  });

  it('reads Working well with the looks line and See it on your store when all is well', () => {
    const view = buildYourStoreView(facts(), en, 'en');
    expect(product(view, 'tryOn')).toMatchObject({
      pill: 'well',
      looks: '15 looks left this month',
      seeIt: { label: 'See it on your store', href: 'https://lulusfashion.com' },
    });
    expect(product(view, 'storeChat')).toMatchObject({ pill: 'well', seeIt: { href: 'https://lulusfashion.com' } });
  });

  it('waits for data until the code is first seen', () => {
    const view = buildYourStoreView(facts({ code: { lastSeenAt: null, connected: false } }), en, 'en');
    expect(product(view, 'tryOn')).toMatchObject({ pill: 'waiting', seeIt: null, sentenceQuiet: true });
    expect(product(view, 'storeChat')).toMatchObject({ pill: 'waiting', seeIt: null });
  });

  it('says In preview, never Working well, while the store is in preview', () => {
    for (const launchState of ['setup', 'preview'] as const) {
      const view = buildYourStoreView(facts({ launchState }), en, 'en');
      for (const key of ['tryOn', 'storeChat'] as const) {
        expect(product(view, key)).toMatchObject({ pill: 'preview', sentence: "Only you can see it while you're in preview.", sentenceQuiet: false });
      }
    }
    expect(product(buildYourStoreView(facts({ launchState: 'holdout' }), en, 'en'), 'tryOn').pill).toBe('well');
  });

  it("turns both products Not working with the can't-see sentence when the code is gone", () => {
    const view = buildYourStoreView(facts({ code: { lastSeenAt: new Date(NOW - CODE_STALE_AFTER_MS - 1).toISOString(), connected: false } }), en, 'en');
    expect(product(view, 'tryOn')).toMatchObject({ pill: 'bad', sentence: "Shoppers can't see the Try-On button right now.", seeIt: null });
    expect(product(view, 'storeChat')).toMatchObject({ pill: 'bad', sentence: "Shoppers can't see Store Chat right now." });
  });

  it('marks Try-On by its looks: Not working at 0, Needs attention under 20 percent', () => {
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ looksLeft: 0 }) }), en, 'en'), 'tryOn')).toMatchObject({
      pill: 'bad',
      looks: '0 looks left this month',
    });
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ looksLeft: 3, looksIncluded: 20 }) }), en, 'en'), 'tryOn').pill).toBe('attention');
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ looksLeft: 4, looksIncluded: 20 }) }), en, 'en'), 'tryOn').pill).toBe('well');
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ planActive: false }) }), en, 'en'), 'tryOn').pill).toBe('bad');
  });

  it('keeps Try-On hidden behind an unproven website address Not working, and a proving shop waiting', () => {
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ pasteReason: 'domain_unverified' }) }), en, 'en'), 'tryOn').pill).toBe('bad');
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ pasteReason: 'shop_proof_pending' }) }), en, 'en'), 'tryOn').pill).toBe('waiting');
    expect(product(buildYourStoreView(facts({ tryOn: tryOn({ pasteReason: 'preview' }), launchState: 'preview' }), en, 'en'), 'tryOn').pill).toBe('preview');
  });

  it('adds the updated-code note to Try-On for outdated pasted Shopify code, with the fix for those who can change it', () => {
    const view = buildYourStoreView(facts({ platform: 'paste_shopify', codeOutdated: true }), en, 'en');
    expect(product(view, 'tryOn').updatedCode).toEqual({
      note: 'Collection pills need your updated code. Everything else keeps working.',
      action: { label: 'Get my updated code', href: INSTALL_HREF },
    });
    expect(product(view, 'tryOn').pill).toBe('well');
    expect(product(buildYourStoreView(facts({ codeOutdated: true, canChange: false }), en, 'en'), 'tryOn').updatedCode?.action).toBeNull();
    expect(product(buildYourStoreView(facts({ codeOutdated: true, tryOn: tryOn({ showButton: false }) }), en, 'en'), 'tryOn').updatedCode).toBeNull();
  });

  it('leaves a product out when the store has no place for it', () => {
    expect(buildYourStoreView(facts({ chat: null }), en, 'en').products.map((p) => p.key)).toEqual(['tryOn']);
  });
});

describe('buildYourStoreView, each platform', () => {
  it('treats the Shopify app install as the code being on the store', () => {
    const view = buildYourStoreView(
      facts({ platform: 'shopify_app', address: 'lulus.myshopify.com', storeUrl: 'https://lulus.myshopify.com', code: { lastSeenAt: null, connected: true } }),
      en,
      'en',
    );
    expect(product(view, 'tryOn').pill).toBe('well');
    expect(view.check?.well[0]).toMatchObject({ key: 'code', sentence: 'Connected', link: { label: 'Install steps', href: INSTALL_HREF } });
  });

  it('applies the 48-hour rule to the WooCommerce heartbeat', () => {
    const woo = (hours: number) =>
      buildYourStoreView(facts({ platform: 'woocommerce', code: { lastSeenAt: new Date(NOW - hours * HOUR).toISOString(), connected: true } }), en, 'en');
    expect(woo(47).check?.well[0]).toMatchObject({ key: 'code', sentence: 'Seen 1 day ago' });
    expect(woo(49).check?.fix[0]).toMatchObject({ key: 'code', kind: 'bad' });
    expect(buildYourStoreView(facts({ platform: 'woocommerce', code: { lastSeenAt: null, connected: true } }), en, 'en').check?.well[0].sentence).toBe('Connected');
  });

  it('asks Run check now to look at waiting addresses only on a pasted website, for those who can change it', () => {
    const domains = [
      { id: 'd1', domain: 'lulusfashion.com', verified: true, state: 'trusted' as const, reason: null },
      { id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted' as const, reason: 'awaiting_code' },
    ];
    expect(buildYourStoreView(facts({ domains }), en, 'en').recheck).toEqual({ siteId: 'site-1', domainIds: ['d2'] });
    expect(buildYourStoreView(facts({ domains, canChange: false }), en, 'en').recheck).toBeNull();
    expect(buildYourStoreView(facts({ domains, platform: 'paste_shopify' }), en, 'en').recheck).toBeNull();
  });
});

describe('buildYourStoreView, banner and header', () => {
  it('welcomes a just-connected store with both switches off and no Store check (A5.1)', () => {
    const view = buildYourStoreView(facts({ tryOn: tryOn({ showButton: false }), chat: { siteId: 'site-1', enabled: false } }), en, 'en');
    expect(view.banner).toEqual({
      title: 'Your code is working on lulusfashion.com',
      body: 'Shoppers see nothing yet. Turn on what you want below.',
      steps: { label: 'Show the install steps', href: INSTALL_HREF },
    });
    expect(view.check).toBeNull();
    expect(view.header.address).toBeNull();
  });

  it('shows the quiet header line with the address and Install steps otherwise', () => {
    const view = buildYourStoreView(facts(), en, 'en');
    expect(view.banner).toBeNull();
    expect(view.header).toEqual({ address: 'lulusfashion.com', installSteps: { label: 'Install steps', href: INSTALL_HREF } });
    expect(buildYourStoreView(facts({ canChange: false }), en, 'en').header.installSteps).toBeNull();
  });

  it('never claims the code works while it has not been seen', () => {
    const view = buildYourStoreView(
      facts({ code: { lastSeenAt: null, connected: false }, tryOn: tryOn({ showButton: false }), chat: { siteId: 'site-1', enabled: false } }),
      en,
      'en',
    );
    expect(view.banner).toBeNull();
    expect(view.check?.waiting).toBe(true);
  });
});

describe('buildYourStoreView, Store check', () => {
  it('waits for data with no rows until the code is live (A6.3)', () => {
    const check = buildYourStoreView(facts({ code: { lastSeenAt: null, connected: false } }), en, 'en').check!;
    expect(check).toMatchObject({ waiting: true, fix: [], well: [] });
  });

  it('shows the check time once, in the store calendar and both languages', () => {
    expect(buildYourStoreView(facts(), en, 'en').check?.checkedAt).toBe('Checked today at 12:14 PM');
    expect(buildYourStoreView(facts({ timeZone: 'Africa/Cairo' }), ar, 'ar').check?.checkedAt).toBe('آخر فحص اليوم 2:14 م');
  });

  it('collapses healthy rows into Working well, in order', () => {
    const domains = [{ id: 'd1', domain: 'lulusfashion.com', verified: true, state: 'trusted' as const, reason: null }];
    const check = buildYourStoreView(facts({ domains }), en, 'en').check!;
    expect(check.fix).toEqual([]);
    expect(check.well.map((line) => [line.key, line.sentence])).toEqual([
      ['code', 'Seen 3 minutes ago'],
      ['looks', '15 looks left this month'],
      ['storeChat', 'Live'],
      ['addresses', '1 of 1 live'],
    ]);
  });

  it('says Store Chat is in preview rather than live', () => {
    const line = buildYourStoreView(facts({ launchState: 'preview' }), en, 'en').check!.well.find((l) => l.key === 'storeChat');
    expect(line?.sentence).toBe("Only you can see it while you're in preview.");
  });

  it('orders What to fix Not working first, then Needs attention, and only the first Not working fix leads', () => {
    const domains = [
      { id: 'd1', domain: 'lulusfashion.com', verified: true, state: 'trusted' as const, reason: null },
      { id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted' as const, reason: 'awaiting_code' },
      { id: 'd3', domain: 'shop.lulusfashion.com', verified: false, state: 'claimed' as const, reason: 'held_elsewhere' },
    ];
    const stale = new Date(NOW - 3 * 24 * HOUR).toISOString();
    const check = buildYourStoreView(facts({ domains, code: { lastSeenAt: stale, connected: false }, tryOn: tryOn({ looksLeft: 0 }) }), en, 'en').check!;
    expect(check.fix.map((row) => [row.key, row.kind, row.action?.primary])).toEqual([
      ['code', 'bad', true],
      ['looks', 'bad', false],
      ['addresses', 'attention', false],
    ]);
    expect(check.fix[0]).toMatchObject({
      sentence: "We haven't seen your code since Saturday. Usually a theme change removed it.",
      action: { label: 'Reinstall in 1 minute', href: INSTALL_HREF },
    });
    expect(check.fix[1]).toMatchObject({
      sentence: 'Out of looks. The button is hidden from shoppers until you top up.',
      action: { label: 'Top up', href: PLAN_HREF },
    });
    expect(check.fix[2]).toMatchObject({ action: { label: "Prove it's yours", href: INSTALL_HREF } });
    expect(check.fix[2].domains.map((d) => [d.domain, d.state, d.label])).toEqual([
      ['lulusfashion.com', 'live', 'Live'],
      ['www.lulusfashion.com', 'waiting', 'Waiting'],
      ['shop.lulusfashion.com', 'needs_proof', 'Needs proof'],
    ]);
    // A chat the code does not reach is said once, on the code row.
    expect(check.well.find((line) => line.key === 'storeChat')).toBeUndefined();
  });

  it('names the date, not the weekday, once the code has been gone a week', () => {
    const stale = new Date(NOW - 9 * 24 * HOUR).toISOString();
    expect(buildYourStoreView(facts({ code: { lastSeenAt: stale, connected: false } }), en, 'en').check!.fix[0].sentence).toBe(
      "We haven't seen your code since 1 November. Usually a theme change removed it.",
    );
    expect(buildYourStoreView(facts({ code: { lastSeenAt: new Date(NOW - 3 * 24 * HOUR).toISOString(), connected: false } }), ar, 'ar').check!.fix[0].sentence).toBe(
      'لم نرَ الكود منذ يوم السبت. غالبًا حذفه تغيير في القالب.',
    );
  });

  it('flags low looks as Needs attention with Top up, and leads with the primary only for Not working', () => {
    const check = buildYourStoreView(facts({ tryOn: tryOn({ looksLeft: 3 }) }), en, 'en').check!;
    expect(check.fix).toEqual([
      expect.objectContaining({ key: 'looks', kind: 'attention', sentence: '3 looks left this month.', action: { label: 'Top up', href: PLAN_HREF, primary: false } }),
    ]);
  });

  it('points an inactive plan at the plan page, and only the owner gets the link', () => {
    const owner = buildYourStoreView(facts({ tryOn: tryOn({ planActive: false }) }), en, 'en').check!;
    expect(owner.fix[0]).toMatchObject({ key: 'looks', kind: 'bad', action: { label: 'See your plan', href: PLAN_HREF, primary: true } });
    const admin = buildYourStoreView(facts({ canBilling: false, tryOn: tryOn({ looksLeft: 0 }) }), en, 'en').check!;
    expect(admin.fix[0].action).toBeNull();
  });

  it('leaves the looks out while Try-On is off', () => {
    const check = buildYourStoreView(facts({ tryOn: tryOn({ showButton: false, looksLeft: 0 }) }), en, 'en').check!;
    expect(check.fix).toEqual([]);
    expect(check.well.map((line) => line.key)).toEqual(['code', 'storeChat']);
  });

  it('points an address still waiting for its code at the install steps', () => {
    const domains = [{ id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted' as const, reason: 'code_not_found' }];
    expect(buildYourStoreView(facts({ domains, tryOn: tryOn({ showButton: false }) }), en, 'en').check!.fix[0]).toMatchObject({
      key: 'addresses',
      kind: 'attention',
      action: { label: 'Install steps', href: INSTALL_HREF, primary: false },
    });
  });

  it('makes Addresses Not working when no address is live and Try-On is on, matching the Try-On card', () => {
    const domains = [{ id: 'd2', domain: 'www.lulusfashion.com', verified: false, state: 'trusted' as const, reason: 'code_not_found' }];
    const view = buildYourStoreView(facts({ domains, tryOn: tryOn({ pasteReason: 'domain_unverified' }) }), en, 'en');
    expect(product(view, 'tryOn').pill).toBe('bad');
    expect(view.check!.fix).toEqual([
      expect.objectContaining({ key: 'addresses', kind: 'bad', sentence: '0 of 1 live', action: { label: 'Install steps', href: INSTALL_HREF, primary: true } }),
    ]);
  });

  it('gives a member no fix links to pages they cannot open', () => {
    const stale = new Date(NOW - 3 * 24 * HOUR).toISOString();
    const check = buildYourStoreView(facts({ canChange: false, canBilling: false, code: { lastSeenAt: stale, connected: false } }), en, 'en').check!;
    expect(check.fix[0].action).toBeNull();
  });
});

describe('domainLineState', () => {
  it('reads Live, Waiting or Needs proof', () => {
    const base = { id: 'd', domain: 'a.com', verified: false, state: 'trusted' as const, reason: null };
    expect(domainLineState({ ...base, verified: true })).toBe('live');
    expect(domainLineState({ ...base, reason: 'awaiting_code' })).toBe('waiting');
    expect(domainLineState({ ...base, reason: 'unreachable' })).toBe('waiting');
    expect(domainLineState({ ...base, reason: 'proven_elsewhere' })).toBe('needs_proof');
    expect(domainLineState({ ...base, state: 'disputed' })).toBe('needs_proof');
    expect(domainLineState({ ...base, state: 'claimed', reason: 'held_elsewhere' })).toBe('needs_proof');
  });
});

describe('buildTodayStoreCard', () => {
  it('gives one status per product, the check time and the link to Your store', () => {
    const card = buildTodayStoreCard(facts({ tryOn: tryOn({ looksLeft: 0 }), chat: { siteId: 'site-1', enabled: false } }), en, 'en');
    expect(card).toEqual({
      checkedAt: 'Checked today at 12:14 PM',
      products: [
        { key: 'tryOn', name: 'Try-On', pill: 'bad', offLabel: 'Off' },
        { key: 'storeChat', name: 'Store Chat', pill: null, offLabel: 'Off' },
      ],
      link: { label: 'View store check', href: '/dashboard/store' },
    });
  });
});

const emptyHealth = () => ({ inline: 0, floating: 0, detected: 0, missing: 0, listings: 0, pills: 0, photos: 0, photoHost: null as string | null });
describe.each(['en', 'ar'] as const)('Store check observations (%s)', (locale) => {
  const copy = getYourStoreCopy(locale);
  const check = (overrides: Partial<YourStoreFacts> = {}) => buildYourStoreView(facts({ health: emptyHealth(), ...overrides }), copy, locale).check!;
  it('keeps unobserved rows waiting, outside fixes and working well', () => {
    const c = check({ platform: 'paste_shopify' });
    expect(c.fix).toEqual([]);
    expect(c.pending.map((r) => r.key)).toEqual(['productPages', 'productDetails', 'productPhotos', 'collectionPages']);
    expect(c.pending.every((r) => r.sentence === copy.pill.waiting)).toBe(true);
    expect(c.well.some((r) => r.key === 'productPhotos')).toBe(false);
  });
  it('collapses observed inline placement, detected details, fetched photos and listing pills', () => {
    const c = check({ platform: 'paste_shopify', health: { ...emptyHealth(), inline: 12, detected: 12, photos: 2, listings: 1, pills: 24 } });
    expect(c.fix).toEqual([]); expect(c.pending).toEqual([]);
    expect(c.well.slice(-4).map((r) => [r.key, r.sentence])).toEqual([
      ['productPages', copy.rows.inlinePages(12, 12)], ['productDetails', copy.rows.connected],
      ['productPhotos', copy.rows.photosReady], ['collectionPages', copy.rows.pillProducts(24)],
    ]);
  });
  it('orders Not working, Needs attention, then quiet optional rows; only first bad action leads', () => {
    const c = check({ platform: 'paste_shopify', codeOutdated: true, health: { ...emptyHealth(), floating: 1, missing: 3, photoHost: 'cdn.example.com' } });
    expect(c.fix.map((r) => [r.key, r.kind, r.action?.primary])).toEqual([
      ['productDetails', 'bad', true], ['productPhotos', 'bad', false], ['productPages', 'attention', false], ['collectionPages', 'attention', false],
    ]);
    expect(c.fix[0]).toMatchObject({ sentence: copy.rows.missingDetails, action: { label: copy.rows.askUs, href: 'mailto:grindctrlnow@gmail.com' } });
    expect(c.fix[1].sentence).toBe(copy.rows.photoFailure('cdn.example.com'));
    expect(c.fix[2]).toMatchObject({ sentence: copy.rows.floating, action: { label: copy.rows.pickSpot, href: '/dashboard/try-on/setup#button-placement' } });
    expect(c.fix[3]).toMatchObject({ sentence: copy.updatedCodeNote, action: { label: copy.getUpdatedCode, href: INSTALL_HREF } });
  });
  it('uses More you can add for pills off, and only EasyOrders gets the connection line', () => {
    expect(check({ platform: 'paste_shopify', pillsOn: false }).more).toEqual([
      { key: 'collectionPages', title: copy.rows.collectionPages, sentence: copy.rows.pillsOff, link: { label: copy.rows.turnOnPills, href: '/dashboard/try-on/setup' } },
    ]);
    expect(check({ platform: 'paste_website', easyOrders: true }).more[0]).toMatchObject({ sentence: copy.rows.easyOrdersPills });
    const other = check({ platform: 'paste_website' });
    expect([...other.fix, ...other.more, ...other.well, ...other.pending].some((r) => r.key === 'collectionPages')).toBe(false);
  });
  it('withholds unsupported Shopify app rows and respects switch/edit permissions', () => {
    const app = check({ platform: 'shopify_app' });
    expect(app.pending).toEqual([]); expect(app.more).toEqual([]);
    expect(check({ tryOn: tryOn({ showButton: false }) }).pending).toEqual([]);
    expect(check({ canChange: false, health: { ...emptyHealth(), floating: 1 } }).fix[0].action).toBeNull();
    expect(check({ platform: 'paste_shopify', pillsOn: false, canChange: false }).more[0].link).toBeNull();
  });
  it('does not claim missing product details when any visited product was detected', () => {
    expect(check({ health: { ...emptyHealth(), detected: 1, missing: 3 } }).fix).toEqual([]);
  });
  it('B7.4: a chosen spot missing in the last three days needs attention, with Pick again', () => {
    const c = check({ platform: 'paste_website', placement: 'spot', health: { ...emptyHealth(), inline: 5, detected: 5, spotMissing: 2 } });
    expect(c.fix).toEqual([{ key: 'productPages', kind: 'attention', title: copy.rows.productPages, sentence: copy.rows.spotMoved, domains: [],
      action: { label: copy.rows.pickAgain, href: '/dashboard/try-on/setup#button-placement', primary: false } }]);
    // Before any page view of today's window too: the row explains the fallback.
    expect(check({ placement: 'spot', health: { ...emptyHealth(), spotMissing: 1 } }).fix[0].sentence).toBe(copy.rows.spotMoved);
    // Members see the row without the fix.
    expect(check({ placement: 'spot', canChange: false, health: { ...emptyHealth(), spotMissing: 1 } }).fix[0].action).toBeNull();
  });
  it('a found spot, or a missing count left over after switching away, is not a problem', () => {
    expect(check({ placement: 'spot', health: { ...emptyHealth(), inline: 3, detected: 3 } }).fix).toEqual([]);
    expect(check({ placement: 'auto', health: { ...emptyHealth(), inline: 3, detected: 3, spotMissing: 4 } }).fix).toEqual([]);
  });
  it('floating chosen by the owner works as asked, not a fix', () => {
    const c = check({ placement: 'floating', health: { ...emptyHealth(), floating: 6, detected: 6 } });
    expect(c.fix).toEqual([]);
    expect(c.well.find((r) => r.key === 'productPages')).toMatchObject({ sentence: copy.rows.floatingChosen });
  });
  it('B7.4 strings are the handoff strings', () => {
    expect([copy.rows.spotMoved, copy.rows.pickAgain]).toEqual(locale === 'en'
      ? ['Your chosen spot moved. Try-On is showing next to your Buy button until you pick again.', 'Pick again']
      : ['تغيّر المكان الذي اخترته. يظهر زر القياس بجوار زر الشراء حتى تختار من جديد.', 'اختر من جديد']);
  });
});

it('uses the handoff strings word for word in EN/AR', async () => {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const lines = (await readFile(resolve(process.cwd(), '../../docs/design-briefs/pack-a/handoff.txt'), 'utf8')).split(/\r?\n/);
  for (const [locale, offset] of [['en', 0], ['ar', 1]] as const) {
    const c = getYourStoreCopy(locale);
    for (const text of [c.rows.productPages, c.rows.floating, c.rows.pickSpot, c.rows.collectionPages, c.rows.easyOrdersPills,
      c.rows.productPhotos, c.rows.photosReady, c.rows.missingDetails, c.rows.askUs, c.rows.addLine, c.rows.contactUs,
      c.rows.pillsOff, c.rows.turnOnPills, c.rows.inlinePages(12, 12), c.rows.pillProducts(24), c.rows.photoFailure('cdn.example.com')]) {
      expect(lines.some((line, i) => line === text && (offset === 0 ? lines[i - 1]?.startsWith('A6') : lines[i - 2]?.startsWith('A6')))).toBe(true);
    }
  }
});
