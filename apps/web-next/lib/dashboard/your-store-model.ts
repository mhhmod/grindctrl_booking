/* What the Your store page and its Today card show (Pack A handoff, A5 and
   A6), worked out from facts the app already records, so every rule can be
   tested without rendering. The model decides each product's status pill
   and sentence, the heading, and which Store check rows exist and in what
   order. Storefront facts are aggregate observations; absent evidence waits. */

import type { HealthCounts } from '@/lib/store-health/signals';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { LaunchState } from '@/lib/launch/audience';
import { intlLocale } from '@/lib/copy/rules';
import type { PillKind, YourStoreCopy } from './your-store-copy';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Code unseen this long reads as removed from the store (A6.5). */
export const CODE_STALE_AFTER_MS = 48 * HOUR;
/** Fewer looks left than this share of the cycle's looks needs attention. */
export const LOOKS_LOW_SHARE = 0.2;

/** The existing install surface: the steps, the code (updated when it
 *  changes) and each address's proof, on Store Chat's Set up. */
export const INSTALL_HREF = '/dashboard/store-chat/setup#install';
export const PLAN_HREF = '/dashboard/plan';
export const YOUR_STORE_HREF = '/dashboard/store';

/** How GRINDCTRL is on the store: the Shopify app, the WooCommerce plugin,
 *  or pasted code on a Shopify store or any other website. */
export type YourStorePlatform = 'shopify_app' | 'woocommerce' | 'paste_shopify' | 'paste_website';

export type YourStoreDomainFact = {
  id: string;
  domain: string;
  /** Our server found this site's code on the domain, or its proof passed. */
  verified: boolean;
  state: 'trusted' | 'claimed' | 'disputed';
  reason: string | null;
};

export type YourStoreFacts = {
  now: number;
  timeZone: string;
  platform: YourStorePlatform;
  /** The store's address as shoppers type it, and the page it opens. */
  address: string | null;
  storeUrl: string | null;
  /** Owners and admins change the switches and open set up (item 12). */
  canChange: boolean;
  /** Only the owner opens Plan. */
  canBilling: boolean;
  code: {
    /** The latest signal from our code on the store; null when never seen. */
    lastSeenAt: string | null;
    /** The platform reports the install itself (the Shopify app), with no
     *  storefront signal of its own to time it by. */
    connected: boolean;
  };
  launchState: LaunchState;
  /** A pasted Shopify install runs older code than the snippet handed out now. */
  codeOutdated: boolean;
  health?: HealthCounts;
  pillsOn?: boolean;
  easyOrders?: boolean;
  tryOn: null | {
    tenant: string;
    showButton: boolean;
    looksLeft: number;
    looksIncluded: number;
    planActive: boolean;
    /** Pasted code only: why the storefront hides Try-On (lib/paste/status.ts). */
    pasteReason: string | null;
  };
  chat: null | { siteId: string; enabled: boolean };
  /** Pasted code on a website: each address the code runs on. */
  domains: YourStoreDomainFact[];
};

export type ProductKey = 'tryOn' | 'storeChat';
export type Link = { label: string; href: string };

export type ProductCardView = {
  key: ProductKey;
  name: string;
  on: boolean;
  pill: PillKind | null;
  sentence: string;
  /** The default description reads quiet; a status sentence reads at full strength. */
  sentenceQuiet: boolean;
  looks: string | null;
  seeIt: Link | null;
  updatedCode: { note: string; action: Link | null } | null;
  /** The Try-On tenant or the Store Chat site the switch saves to. */
  target: string;
};

export type DomainLine = { domain: string; state: 'live' | 'waiting' | 'needs_proof'; label: string };

export type CheckKey = 'code' | 'looks' | 'addresses' | 'productPages' | 'productDetails' | 'productPhotos' | 'collectionPages';

export type FixRow = {
  key: CheckKey;
  kind: 'bad' | 'attention';
  /** Isolate a Latin hostname inside an Arabic sentence without altering copy. */
  host?: string;
  title: string;
  sentence: string;
  domains: DomainLine[];
  action: (Link & { primary: boolean }) | null;
};

export type WellLine = { key: CheckKey | 'storeChat'; title: string; sentence: string; link: Link | null };

export type StoreCheckView = {
  checkedAt: string;
  /** No signal from the code yet: nothing to check (A6.3). */
  waiting: boolean;
  fix: FixRow[];
  well: WellLine[];
  more: WellLine[];
  pending: WellLine[];
};

export type YourStoreView = {
  header: { address: string | null; installSteps: Link | null };
  /** Both switches off while the code works (A5.1). */
  banner: { title: string; body: string; steps: Link | null } | null;
  heading: string;
  products: ProductCardView[];
  check: StoreCheckView | null;
  /** Pasted website addresses still waiting, which Run check now looks at again. */
  recheck: { siteId: string; domainIds: string[] } | null;
};

export type TodayStoreCardView = {
  checkedAt: string;
  products: Array<{ key: ProductKey; name: string; pill: PillKind | null; offLabel: string }>;
  link: Link;
};

type CodeState = 'waiting' | 'ok' | 'stale';

function codeState(facts: YourStoreFacts): CodeState {
  const seen = facts.code.lastSeenAt ? Date.parse(facts.code.lastSeenAt) : NaN;
  if (Number.isFinite(seen)) return facts.now - seen > CODE_STALE_AFTER_MS ? 'stale' : 'ok';
  return facts.code.connected ? 'ok' : 'waiting';
}

const inPreview = (state: LaunchState) => state === 'setup' || state === 'preview';

export function looksLow(tryOn: { looksLeft: number; looksIncluded: number }): boolean {
  return tryOn.looksLeft > 0 && tryOn.looksIncluded > 0 && tryOn.looksLeft / tryOn.looksIncluded < LOOKS_LOW_SHARE;
}

/* Pasted-code reasons the storefront hides Try-On that a card already
   covers some other way: preview has its own pill, the looks and the plan
   their own row, a shop still proving itself is waiting for its code. */
const PASTE_REASONS_COVERED = new Set(['preview', 'out_of_looks', 'plan_inactive', 'shop_proof_pending']);

export function domainLineState(domain: YourStoreDomainFact): DomainLine['state'] {
  if (domain.verified && domain.state === 'trusted') return 'live';
  if (domain.state !== 'trusted' || domain.reason === 'held_elsewhere' || domain.reason === 'proven_elsewhere') return 'needs_proof';
  return 'waiting';
}

export function productsHeading(anyOn: boolean, copy: YourStoreCopy): string {
  return anyOn ? copy.headingOn : copy.headingOff;
}

function tryOnPill(facts: YourStoreFacts, code: CodeState): { pill: PillKind; cant: boolean; preview: boolean } {
  const tryOn = facts.tryOn!;
  if (code === 'waiting' || tryOn.pasteReason === 'shop_proof_pending') return { pill: 'waiting', cant: false, preview: false };
  const blocked =
    code === 'stale' ||
    !tryOn.planActive ||
    tryOn.looksLeft <= 0 ||
    (tryOn.pasteReason !== null && !PASTE_REASONS_COVERED.has(tryOn.pasteReason));
  if (blocked) return { pill: 'bad', cant: true, preview: false };
  if (inPreview(facts.launchState)) return { pill: 'preview', cant: false, preview: true };
  if (looksLow(tryOn)) return { pill: 'attention', cant: false, preview: false };
  return { pill: 'well', cant: false, preview: false };
}

function chatPill(facts: YourStoreFacts, code: CodeState): { pill: PillKind; cant: boolean; preview: boolean } {
  if (code === 'waiting') return { pill: 'waiting', cant: false, preview: false };
  if (code === 'stale') return { pill: 'bad', cant: true, preview: false };
  if (inPreview(facts.launchState)) return { pill: 'preview', cant: false, preview: true };
  return { pill: 'well', cant: false, preview: false };
}

function productCards(facts: YourStoreFacts, copy: YourStoreCopy, code: CodeState): ProductCardView[] {
  const cards: ProductCardView[] = [];
  const seeIt = facts.storeUrl ? { label: copy.seeItOnYourStore, href: facts.storeUrl } : null;
  if (facts.tryOn) {
    const on = facts.tryOn.showButton;
    const status = on ? tryOnPill(facts, code) : null;
    cards.push({
      key: 'tryOn',
      name: copy.products.tryOn.name,
      on,
      pill: status?.pill ?? null,
      sentence: status?.cant ? copy.products.tryOn.cant : status?.preview ? copy.preview : copy.products.tryOn.sentence,
      sentenceQuiet: !status?.cant && !status?.preview,
      looks: on ? copy.looksLeftThisMonth(Math.max(0, facts.tryOn.looksLeft)) : null,
      // Nothing to see while shoppers can't see it, or before the first signal.
      seeIt: on && status?.pill !== 'bad' && status?.pill !== 'waiting' ? seeIt : null,
      updatedCode:
        on && facts.codeOutdated
          ? { note: copy.updatedCodeNote, action: facts.canChange ? { label: copy.getUpdatedCode, href: INSTALL_HREF } : null }
          : null,
      target: facts.tryOn.tenant,
    });
  }
  if (facts.chat) {
    const on = facts.chat.enabled;
    const status = on ? chatPill(facts, code) : null;
    cards.push({
      key: 'storeChat',
      name: copy.products.storeChat.name,
      on,
      pill: status?.pill ?? null,
      sentence: status?.cant ? copy.products.storeChat.cant : status?.preview ? copy.preview : copy.products.storeChat.sentence,
      sentenceQuiet: !status?.cant && !status?.preview,
      looks: null,
      seeIt: on && status?.pill !== 'bad' && status?.pill !== 'waiting' ? seeIt : null,
      updatedCode: null,
      target: facts.chat.siteId,
    });
  }
  return cards;
}

export function relativeAgo(iso: string, now: number, copy: YourStoreCopy): string {
  const minutes = Math.floor((now - Date.parse(iso)) / MINUTE);
  if (minutes < 1) return copy.ago.justNow;
  if (minutes < 60) return copy.ago.minutes(minutes);
  if (minutes < 24 * 60) return copy.ago.hours(Math.floor(minutes / 60));
  return copy.ago.days(Math.floor(minutes / (24 * 60)));
}

/** "Monday" within the last week, else "2 November", in the store's calendar. */
export function sinceWhen(iso: string, now: number, copy: YourStoreCopy, locale: SiteLocale, timeZone: string): string {
  const at = new Date(iso);
  const lang = locale === 'ar' ? intlLocale('ar') : 'en-GB';
  if (now - at.getTime() < 7 * DAY) {
    return copy.since.weekday(new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone }).format(at));
  }
  return copy.since.date(new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', timeZone }).format(at));
}

export function checkedAtTime(now: number, locale: SiteLocale, timeZone: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(now));
}

function storeCheck(facts: YourStoreFacts, copy: YourStoreCopy, locale: SiteLocale, code: CodeState): StoreCheckView {
  const checkedAt = copy.check.checkedAt(checkedAtTime(facts.now, locale, facts.timeZone));
  if (code === 'waiting') return { checkedAt, waiting: true, fix: [], well: [], more: [], pending: [] };
  const r = copy.rows;
  const bad: FixRow[] = [];
  const attention: FixRow[] = [];
  const well: WellLine[] = [];
  const more: WellLine[] = [];
  const pending: WellLine[] = [];
  const setUp = (label: string) => (facts.canChange ? { label, href: INSTALL_HREF } : null);
  const plan = (label: string) => (facts.canBilling ? { label, href: PLAN_HREF } : null);

  if (code === 'stale') {
    bad.push({
      key: 'code',
      kind: 'bad',
      title: r.code,
      sentence: r.notSeenSince(sinceWhen(facts.code.lastSeenAt!, facts.now, copy, locale, facts.timeZone)),
      domains: [],
      action: withPrimary(setUp(r.reinstall)),
    });
  } else {
    well.push({
      key: 'code',
      title: r.code,
      sentence: facts.code.lastSeenAt ? r.seen(relativeAgo(facts.code.lastSeenAt, facts.now, copy)) : r.connected,
      link: setUp(copy.installSteps),
    });
  }

  // The looks only matter while the Try-On button is switched on.
  const tryOn = facts.tryOn;
  if (tryOn?.showButton) {
    const left = Math.max(0, tryOn.looksLeft);
    if (!tryOn.planActive) {
      bad.push({ key: 'looks', kind: 'bad', title: r.looks, sentence: r.planInactive, domains: [], action: withPrimary(plan(r.seePlan)) });
    } else if (left <= 0) {
      bad.push({ key: 'looks', kind: 'bad', title: r.looks, sentence: r.outOfLooks, domains: [], action: withPrimary(plan(r.topUp)) });
    } else if (looksLow(tryOn)) {
      attention.push({ key: 'looks', kind: 'attention', title: r.looks, sentence: r.looksLow(left), domains: [], action: withPrimary(plan(r.topUp)) });
    } else {
      well.push({ key: 'looks', title: r.looks, sentence: copy.looksLeftThisMonth(left), link: null });
    }
  }

  // A chat the code does not reach is the code row's problem, said once.
  if (facts.chat?.enabled && code === 'ok') {
    well.push({ key: 'storeChat', title: r.storeChat, sentence: inPreview(facts.launchState) ? copy.preview : r.live, link: null });
  }

  if (facts.domains.length > 0) {
    const lines: DomainLine[] = facts.domains.map((domain) => {
      const state = domainLineState(domain);
      const label = state === 'live' ? r.domainLive : state === 'waiting' ? r.domainWaiting : r.domainNeedsProof;
      return { domain: domain.domain, state, label };
    });
    const live = lines.filter((line) => line.state === 'live').length;
    if (live === lines.length) {
      well.push({ key: 'addresses', title: r.addresses, sentence: r.liveCount(live, lines.length), link: null });
    } else {
      const needsProof = lines.some((line) => line.state === 'needs_proof');
      // Try-On waits for a confirmed address, so none live is why its card reads Not working.
      const blocksTryOn = live === 0 && Boolean(facts.tryOn?.showButton);
      (blocksTryOn ? bad : attention).push({
        key: 'addresses',
        kind: blocksTryOn ? 'bad' : 'attention',
        title: r.addresses,
        sentence: r.liveCount(live, lines.length),
        domains: lines,
        // A waiting address has no code found on it yet: the steps are the fix.
        action: withPrimary(setUp(needsProof ? r.proveItsYours : copy.installSteps)),
      });
    }
  }

  if (tryOn?.showButton && facts.platform !== 'shopify_app') {
    const health = facts.health;
    const tryOnSetup = (label: string) => facts.canChange ? { label, href: '/dashboard/try-on/setup' } : null;
    const support = (label: string) => ({ label, href: 'mailto:grindctrlnow@gmail.com' });
    const wait = (key: CheckKey, title: string) => pending.push({ key, title, sentence: copy.pill.waiting, link: null });
    const problem = (key: CheckKey, kind: FixRow['kind'], title: string, sentence: string, link: Link | null, host?: string) =>
      (kind === 'bad' ? bad : attention).push({ key, kind, title, sentence, domains: [], action: withPrimary(link), ...(host ? { host } : {}) });
    const pages = (health?.inline ?? 0) + (health?.floating ?? 0);
    if (!pages) wait('productPages', r.productPages);
    else if (health!.floating > 0) problem('productPages', 'attention', r.productPages, r.floating, tryOnSetup(r.pickSpot));
    else well.push({ key: 'productPages', title: r.productPages, sentence: r.inlinePages(health!.inline, pages), link: null });

    if (!health || health.detected + health.missing === 0) wait('productDetails', r.productDetails);
    else if (health.detected === 0) problem('productDetails', 'bad', r.productDetails, r.missingDetails, support(r.askUs));
    else well.push({ key: 'productDetails', title: r.productDetails, sentence: r.connected, link: null });

    if (health?.photoHost) problem('productPhotos', 'bad', r.productPhotos, r.photoFailure(health.photoHost), support(r.contactUs), health.photoHost);
    else if (health?.photos) well.push({ key: 'productPhotos', title: r.productPhotos, sentence: r.photosReady, link: null });
    else wait('productPhotos', r.productPhotos);

    if (facts.platform === 'paste_website') {
      if (facts.easyOrders) more.push({ key: 'collectionPages', title: r.collectionPages, sentence: r.easyOrdersPills, link: null });
    } else if (facts.platform === 'paste_shopify' && facts.codeOutdated) {
      problem('collectionPages', 'attention', r.collectionPages, copy.updatedCodeNote, setUp(copy.getUpdatedCode));
    } else if (facts.pillsOn === false) {
      more.push({ key: 'collectionPages', title: r.collectionPages, sentence: r.pillsOff, link: tryOnSetup(r.turnOnPills) });
    } else if (health?.listings) {
      well.push({ key: 'collectionPages', title: r.collectionPages, sentence: r.pillProducts(health.pills), link: null });
    } else wait('collectionPages', r.collectionPages);
  }

  // Not working first, then needs attention; only the first Not working fix leads.
  const fix = [...bad, ...attention].map((row, index) =>
    row.action ? { ...row, action: { ...row.action, primary: row.kind === 'bad' && bad.findIndex((b) => b.action) === index } } : row,
  );
  return { checkedAt, waiting: false, fix, well, more, pending };
}

function withPrimary(link: Link | null): (Link & { primary: boolean }) | null {
  return link ? { ...link, primary: false } : null;
}

export function buildYourStoreView(facts: YourStoreFacts, copy: YourStoreCopy, locale: SiteLocale): YourStoreView {
  const code = codeState(facts);
  const products = productCards(facts, copy, code);
  const anyOn = products.some((product) => product.on);
  const steps = facts.canChange ? { label: copy.showInstallSteps, href: INSTALL_HREF } : null;
  // The just-connected welcome only while it is true: the code works and shoppers see nothing.
  const banner =
    !anyOn && code === 'ok' && facts.address
      ? { title: copy.codeWorkingOn(facts.address), body: copy.shoppersSeeNothing, steps }
      : null;
  const waitingDomains = facts.domains.filter((domain) => domainLineState(domain) === 'waiting').map((domain) => domain.id);
  return {
    header: {
      address: banner ? null : facts.address,
      installSteps: banner || !facts.canChange ? null : { label: copy.installSteps, href: INSTALL_HREF },
    },
    banner,
    heading: productsHeading(anyOn, copy),
    products,
    check: banner ? null : storeCheck(facts, copy, locale, code),
    recheck:
      facts.platform === 'paste_website' && facts.chat && facts.canChange && waitingDomains.length > 0
        ? { siteId: facts.chat.siteId, domainIds: waitingDomains }
        : null,
  };
}

/** The compact card at the top of Today: one status per product. */
export function buildTodayStoreCard(facts: YourStoreFacts, copy: YourStoreCopy, locale: SiteLocale): TodayStoreCardView {
  const code = codeState(facts);
  return {
    checkedAt: copy.check.checkedAt(checkedAtTime(facts.now, locale, facts.timeZone)),
    products: productCards(facts, copy, code).map(({ key, name, pill }) => ({ key, name, pill, offLabel: copy.off })),
    link: { label: copy.todayCard.viewStoreCheck, href: YOUR_STORE_HREF },
  };
}
