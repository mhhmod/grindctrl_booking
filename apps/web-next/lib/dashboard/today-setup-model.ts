/* What the v16 Today shows while a store is being set up (04-dashboard.md,
   the Today-Setup board), worked out from facts the app already has, so the
   rules can be tested without rendering. Each step ticks itself from a
   storefront signal:
   - Store connected: the shop is installed (the page is only shown then).
   - Turn GrindCTRL on in your theme: Store Chat's loader has booted on the
     store (in the theme editor, or for the owner's preview link while the
     store is not live), and a look has been started on the store. The
     theme itself is read with item 24 (N24), so neither piece is called
     missing here, only not ready yet.
   - Try it yourself: the owner has made a test look.
   - Go live: never ticked here; going live leaves this page for Today.
   Left out until their back ends exist: the product count and languages
   on Store connected, the theme's name, Check what the assistant learned
   (N8, N11), and the live view of the product page. */

import { appEmbedActivationUrl, productBlockAddUrl } from '@/lib/shopify/app-identity';
import type { TodaySetupCopy } from './today-setup-copy';

/** The board's "4 steps left, about 8 minutes". */
export const MINUTES_PER_STEP = 2;

export type TodaySetupFacts = {
  /** The store's name as the store switcher shows it. */
  store: string;
  /** The Shopify shop. */
  shop: string;
  /** When Store Chat's loader last booted on the store, if ever. */
  chatSeenAt: string | null;
  /** A look has been started on the store (a test look counts). */
  storeLook: boolean;
  /** The owner has made a test look from the preview link. */
  testLook: boolean;
  /** The 50/50 test can be chosen (n6_holdout). */
  holdoutAvailable: boolean;
};

export type SetupStepKey = 'connected' | 'theme' | 'tryIt' | 'goLive';

export type SetupStep = { key: SetupStepKey; number: number; title: string; done: boolean; line: string | null };

export type ThemePiece = {
  key: 'chat' | 'tryOn';
  name: string;
  ready: boolean;
  /** Where to turn the piece on, beside it. The Try it on block's link is
   *  the step's own button, "Add the button to product pages". */
  href: string | null;
};

export type TodaySetupView = {
  title: string;
  stepsLeft: string;
  /** Finished steps, as a share of all steps (0 to 100). */
  progress: number;
  /** The first step not done, opened on arrival. */
  current: SetupStepKey;
  steps: SetupStep[];
  pieces: ThemePiece[];
  addButtonHref: string;
  holdoutAvailable: boolean;
};

export function buildTodaySetupView(facts: TodaySetupFacts, copy: TodaySetupCopy): TodaySetupView {
  const pieces: ThemePiece[] = [
    { key: 'chat', name: copy.chatEmbed, ready: facts.chatSeenAt !== null, href: appEmbedActivationUrl(facts.shop, 'messenger') },
    { key: 'tryOn', name: copy.tryOnBlock, ready: facts.storeLook, href: null },
  ];
  const steps: SetupStep[] = [
    { key: 'connected', number: 1, title: copy.connected, done: true, line: facts.shop },
    { key: 'theme', number: 2, title: copy.theme, done: pieces.every((piece) => piece.ready), line: null },
    { key: 'tryIt', number: 3, title: copy.tryIt, done: facts.testLook, line: null },
    { key: 'goLive', number: 4, title: copy.goLive, done: false, line: null },
  ];
  const left = steps.filter((step) => !step.done).length;
  return {
    title: copy.title(facts.store),
    stepsLeft: copy.stepsLeft(left, left * MINUTES_PER_STEP),
    progress: Math.round(((steps.length - left) / steps.length) * 100),
    current: steps.find((step) => !step.done)?.key ?? 'goLive',
    steps,
    pieces,
    addButtonHref: productBlockAddUrl(facts.shop, 'tryon'),
    holdoutAvailable: facts.holdoutAvailable,
  };
}
