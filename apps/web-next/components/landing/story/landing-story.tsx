'use client';

/* The landing page: a paced product story in five scenes, then the rest of
   the page. See docs/handoff/site-v15/02-landing.md.

   The scenes are sections with a sticky sheet inside; story-controller.ts
   paces them (one gesture, one beat) and writes the per-frame values. The
   views in ./views are the prototype's markup ported to TSX, one per scene
   and layout. Phones and tablets (under 1000px) get the phone layout. The
   server guesses the layout from the request and the client corrects it
   after hydration, as the prototype does. Scenes after the first load as
   their own chunks so the first screen does not wait for them. */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { siteFooterCopy, siteHeaderCopy, storyNavigation, type StorySceneId } from '@/components/site/marketing-chrome';
import { BackgroundWiring } from '@/components/site/background-wiring';
import { SiteFooter, type SiteFooterLink } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';
import { trackClick } from '@/lib/analytics';
import { findPublicTruthRecord, isPublishableWithoutOwnerReview } from '@/lib/product-truth/public-register';
import { cn } from '@/lib/utils';
import { StoryController, type StoryState } from './story-controller';
import { BEATS, LEN, SCENE_ORDER, type SceneKey } from './story-data';
import { STORY_TRACES } from './story-strings';
import { StorySprites } from './story-sprites';
import type { StoryLayout, StoryT, V } from './story-types';
import {
  CHAT_KEYS,
  chatVals,
  OPS_KEYS,
  opsVals,
  PRODUCT_KEYS,
  productVals,
  RESULTS_KEYS,
  resultsVals,
  STORE_KEYS,
  storeVals,
  storyText,
  TRY_KEYS,
  tryVals,
  type ValsEnv,
} from './story-vals';
import { DeskTry } from './views/desk-try';
import { PhoneTry } from './views/phone-try';

const pick = <K extends string>(name: K) => (m: Record<K, React.ComponentType<{ v: V; t: StoryT }>>) => m[name];
const DeskStore = dynamic(() => import('./views/desk-store').then(pick('DeskStore')));
const DeskOps = dynamic(() => import('./views/desk-ops').then(pick('DeskOps')));
const DeskProduct = dynamic(() => import('./views/desk-product').then(pick('DeskProduct')));
const DeskResults = dynamic(() => import('./views/desk-results').then(pick('DeskResults')));
const DeskStack = dynamic(() => import('./views/desk-stack').then(pick('DeskStack')));
const DeskJourney = dynamic(() => import('./views/desk-journey').then(pick('DeskJourney')));
const DeskCta = dynamic(() => import('./views/desk-cta').then(pick('DeskCta')));
const PhoneStore = dynamic(() => import('./views/phone-store').then(pick('PhoneStore')));
const PhoneOps = dynamic(() => import('./views/phone-ops').then(pick('PhoneOps')));
const PhoneProduct = dynamic(() => import('./views/phone-product').then(pick('PhoneProduct')));
const PhoneResults = dynamic(() => import('./views/phone-results').then(pick('PhoneResults')));
const PhoneChat = dynamic(() => import('./views/phone-chat').then(pick('PhoneChat')));
const PhoneStack = dynamic(() => import('./views/phone-stack').then(pick('PhoneStack')));
const PhoneCta = dynamic(() => import('./views/phone-cta').then(pick('PhoneCta')));

const PHONE_QUERY = '(max-width: 999.98px)';
/* Matches the stacked layout rule in globals.css. */
const STACK_QUERY = '(max-height: 559.98px), (prefers-reduced-motion: reduce)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function matches(query: string) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

const SCENE_OF: Record<StorySceneId, SceneKey> = { try: 'tryon', store: 'store', ops: 'ops', product: 'product', results: 'results' };

const MANAGED_SETUP = (() => {
  const record = findPublicTruthRecord('service.managed-setup');
  return record ? isPublishableWithoutOwnerReview(record) : false;
})();

/** Re-renders only when one of `keys` changes, so one scene's tick leaves the others alone. */
function useStorySlice(controller: StoryController, keys: readonly (keyof StoryState)[]) {
  const cache = React.useRef<StoryState | null>(null);
  const getSnapshot = React.useCallback(() => {
    const s = controller.getState();
    const prev = cache.current;
    if (prev && keys.every((key) => prev[key] === s[key])) return prev;
    cache.current = s;
    return s;
  }, [controller, keys]);
  return React.useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
}

type SceneProps = {
  controller: StoryController;
  env: ValsEnv;
  common: V;
  t: StoryT;
};

function useVals(
  controller: StoryController,
  keys: readonly (keyof StoryState)[],
  compute: (s: StoryState, env: ValsEnv) => V,
  env: ValsEnv,
  common: V,
) {
  const s = useStorySlice(controller, keys);
  return React.useMemo(() => ({ ...common, ...compute(s, env) }), [s, env, common, compute]);
}

/* ---------------------------------------------------------------- scene shells */
const FRAME_KEY: Record<SceneKey, string> = { tryon: 'A', store: 'S', ops: 'O', product: 'B', results: 'C' };
const SCENE_BG: Record<SceneKey, string> = {
  tryon: 'var(--background)',
  store: 'var(--gc-sheet-store)',
  ops: 'var(--gc-sheet-dark)',
  product: 'var(--background)',
  results: 'var(--background)',
};
const TITLE_ID: Record<StoryLayout, Record<SceneKey, string>> = {
  desk: { tryon: 'hero-title', store: 'store-title', ops: 'ops-title', product: 'product-title', results: 'results-title' },
  phone: { tryon: 'm-hero-title', store: 'store-title', ops: 'ops-title', product: 'm-product-title', results: 'results-title' },
};

function SceneShell({
  scene,
  layout,
  index,
  traces,
  children,
}: {
  scene: SceneKey;
  layout: StoryLayout;
  index: number;
  traces: string[];
  children: React.ReactNode;
}) {
  const key = FRAME_KEY[scene];
  const len = LEN[scene] * 100;
  const dark = scene === 'ops';
  return (
    <section
      id={scene === 'tryon' ? 'try' : scene}
      data-scene={scene}
      aria-labelledby={TITLE_ID[layout][scene]}
      className="gc-story-scene"
      style={{ zIndex: index + 1, '--gc-len': len } as React.CSSProperties}
    >
      {BEATS[scene].map((f, i) => (
        <i key={i} data-beat={`${scene}:${i}`} aria-hidden="true" className="gc-story-beat" style={{ top: `${f * len}svh` }} />
      ))}
      <div
        data-k={`sheet${key}`}
        className={cn('gc-story-sheet gc-frame', dark && 'gc-sheet-dark')}
        style={{ background: SCENE_BG[scene], color: dark ? 'var(--gc-cream)' : undefined }}
      >
        <div data-k={`env${key}`} className="gc-story-env">
          <BackgroundWiring trace={traces} />
        </div>
        {scene === 'results' ? (
          children
        ) : (
          <div data-k={`rec${key}`} className="gc-story-rec">
            {children}
            <div data-k={`dim${key}`} aria-hidden="true" className="gc-story-dim" />
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- scenes */
function TryScene({ controller, env, common, t }: SceneProps) {
  const tv = useVals(controller, TRY_KEYS, tryVals, env, common);
  const cv = useStorySlice(controller, CHAT_KEYS);
  const v = React.useMemo(() => ({ ...tv, ...chatVals(cv, env) }), [tv, cv, env]);
  return env.layout === 'desk' ? <DeskTry v={v} t={t} /> : <PhoneTry v={v} t={t} />;
}

function StoreScene({ controller, env, common, t }: SceneProps) {
  const v = useVals(controller, STORE_KEYS, storeVals, env, common);
  return env.layout === 'desk' ? <DeskStore v={v} t={t} /> : <PhoneStore v={v} t={t} />;
}

function OpsScene({ controller, env, common, t }: SceneProps) {
  const v = useVals(controller, OPS_KEYS, opsVals, env, common);
  return env.layout === 'desk' ? <DeskOps v={v} t={t} /> : <PhoneOps v={v} t={t} />;
}

function ProductScene({ controller, env, common, t }: SceneProps) {
  const v = useVals(controller, PRODUCT_KEYS, productVals, env, common);
  return env.layout === 'desk' ? <DeskProduct v={v} t={t} /> : <PhoneProduct v={v} t={t} />;
}

function ResultsScene({ controller, env, common, t }: SceneProps) {
  const v = useVals(controller, RESULTS_KEYS, resultsVals, env, common);
  return env.layout === 'desk' ? <DeskResults v={v} t={t} /> : <PhoneResults v={v} t={t} />;
}

function ChatSection({ controller, env, common, t }: SceneProps) {
  const v = useVals(controller, CHAT_KEYS, chatVals, env, common);
  return <PhoneChat v={v} t={t} />;
}

/* ---------------------------------------------------------------- rail and phone progress */
const RAIL_LABEL: Array<Parameters<StoryT>[0]> = ['Try it on', 'Live store', 'AI operations', 'The product', 'Results'];
const RAIL_ARIA: Array<Parameters<StoryT>[0]> = [
  'Go to Try it on',
  'Go to Live store',
  'Go to AI operations',
  'Go to The product',
  'Go to Results',
];

function StoryRail({ t, onGo }: { t: StoryT; onGo: (i: number) => void }) {
  return (
    <nav
      data-k="rail"
      aria-label={t('Page scenes')}
      className="gc-frame fixed end-[clamp(10px,1.5vw,26px)] top-1/2 z-[45] flex flex-col gap-0.5 text-foreground"
      style={{ opacity: 0, visibility: 'hidden', transform: 'translate3d(14px, -50%, 0)', transition: 'color 0.45s ease' }}
    >
      {RAIL_LABEL.map((label, i) => (
        <button
          key={label}
          type="button"
          data-rail-item=""
          aria-label={t(RAIL_ARIA[i])}
          onClick={() => onGo(i)}
          className="relative flex cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent px-1.5 py-[5px] text-inherit"
        >
          <span
            data-k={`rn${i}`}
            className="text-[11.5px] font-extrabold tabular-nums tracking-[0.02em]"
            style={{ opacity: 0.45, transition: 'opacity 0.3s ease' }}
          >
            {`0${i + 1}`}
          </span>
          <span className="relative block h-[34px] w-[3px]">
            <span className="absolute inset-0 rounded-sm bg-current opacity-[0.18]" />
            <span data-k={`rf${i}`} className="absolute inset-0 origin-top rounded-sm bg-current" style={{ transform: 'scaleY(0)' }} />
          </span>
          <span
            data-tip=""
            aria-hidden="true"
            className="pointer-events-none absolute end-[calc(100%+6px)] top-[3px] whitespace-nowrap rounded-xl bg-[var(--gc-ink)] px-2.5 py-[5px] text-xs font-semibold text-[var(--gc-cream)] opacity-0 ltr:translate-x-1.5 rtl:-translate-x-1.5"
            style={{ transition: 'opacity 0.2s ease, transform 0.2s ease' }}
          >
            {t(label)}
          </span>
        </button>
      ))}
    </nav>
  );
}

function StoryProgress() {
  return (
    <div
      data-k="prog"
      aria-hidden="true"
      className="gc-frame pointer-events-none fixed start-1/2 z-50 flex w-40 gap-1 text-foreground ltr:-ml-20 rtl:-mr-20 lg:hidden"
      style={{ top: 'calc(76px + env(safe-area-inset-top, 0px))', opacity: 0, transition: 'opacity 0.3s ease, color 0.45s ease' }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="relative h-[3px] flex-1 overflow-hidden rounded-sm bg-current/15">
          <span data-k={`pf${i}`} className="absolute inset-0 bg-current" style={{ transformOrigin: 'var(--gc-start) center', transform: 'scaleX(0)' }} />
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- the page */
export function LandingStory({ initialLayout = 'desk' }: { initialLayout?: StoryLayout }) {
  const { locale, t: lt, toggleLocale } = useLandingLocale();
  const rtl = locale === 'ar';
  const [layout, setLayout] = React.useState<StoryLayout>(initialLayout);
  /* Neither value changes the markup, so reading them on the first client
     render cannot cause a hydration mismatch; it saves a second measuring pass. */
  const [stacked, setStacked] = React.useState(() => matches(STACK_QUERY));
  const [reduce, setReduce] = React.useState(() => matches(REDUCE_QUERY));
  const [activeScene, setActiveScene] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [controller] = React.useState(
    () => new StoryController({ layout: initialLayout, stacked: false, reduce: false, rtl }, locale),
  );
  const t = React.useMemo(() => storyText(locale), [locale]);

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const phone = window.matchMedia(PHONE_QUERY);
    const stack = window.matchMedia(STACK_QUERY);
    const red = window.matchMedia(REDUCE_QUERY);
    const sync = () => {
      setLayout(phone.matches ? 'phone' : 'desk');
      setStacked(stack.matches);
      setReduce(red.matches);
    };
    sync();
    phone.addEventListener('change', sync);
    stack.addEventListener('change', sync);
    red.addEventListener('change', sync);
    return () => {
      phone.removeEventListener('change', sync);
      stack.removeEventListener('change', sync);
      red.removeEventListener('change', sync);
    };
  }, []);

  React.useEffect(() => {
    controller.setCallbacks({ onScene: setActiveScene });
    return () => controller.setCallbacks({});
  }, [controller]);

  /* Mount once, then measure again whenever the layout, stacking or language changes. */
  const lastLocale = React.useRef(locale);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const env = { layout, stacked, reduce, rtl };
    if (!controller.mounted) {
      controller.mount(root, env);
      lastLocale.current = locale;
    } else {
      const localeChanged = lastLocale.current !== locale;
      lastLocale.current = locale;
      controller.relayout(root, env, { restartChat: localeChanged ? locale : undefined });
    }
    /* Ready once the layout the viewport asks for is on screen and measured
       (the server's guess may be about to be corrected). Tests wait on it. */
    root.toggleAttribute('data-ready', layout === (matches(PHONE_QUERY) ? 'phone' : 'desk'));
  }, [controller, layout, stacked, reduce, rtl, locale]);

  React.useEffect(() => () => controller.unmount(), [controller]);

  const env = React.useMemo<ValsEnv>(
    () => ({ layout, locale, rtl, controller, managedSetup: MANAGED_SETUP }),
    [layout, locale, rtl, controller],
  );

  const common = React.useMemo<V>(() => {
    const cache = new Map<string, (e: React.MouseEvent) => void>();
    const handler = (key: string, make: () => (e: React.MouseEvent) => void) => {
      let fn = cache.get(key);
      if (!fn) {
        fn = make();
        cache.set(key, fn);
      }
      return fn;
    };
    return {
      bookFrom: (section: string) =>
        handler(`book:${section}`, () => () => trackClick('cta_clicked', { cta: 'book_call', section: `landing_${section}` })),
      tryFrom: (section: string) =>
        handler(`try:${section}`, () => () => trackClick('cta_clicked', { cta: 'try_on', section: `landing_${section}` })),
      storeFrom: (section: string) =>
        handler(`store:${section}`, () => () => trackClick('cta_clicked', { cta: 'open_store', section: `landing_${section}` })),
      goStore: (e: React.MouseEvent) => {
        e.preventDefault();
        controller.goScene('store');
      },
      passCopy: {
        label: lt.passwordLabel,
        copy: lt.passwordCopy,
        copied: lt.passwordCopied,
        selected: lt.passwordSelected,
        copyAria: lt.passwordCopyAria,
        copiedAria: lt.passwordCopiedAria,
      },
      managedSetup: MANAGED_SETUP,
      pageLang: locale,
      pageDir: locale === 'ar' ? 'rtl' : 'ltr',
    };
  }, [controller, lt, locale]);

  const onScene = React.useCallback(
    (id: StorySceneId, event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      controller.goScene(SCENE_OF[id]);
    },
    [controller],
  );
  const { nav, menu } = storyNavigation(lt, {
    onScene,
    onJourney: (event) => {
      event.preventDefault();
      controller.goSection('journey');
    },
    onChat: (event) => {
      event.preventDefault();
      controller.goSection('chat');
    },
  });
  const activeId = activeScene >= 0 ? (['try', 'store', 'ops', 'product', 'results'] as const)[activeScene] : null;

  const footerLinks: SiteFooterLink[] = [
    {
      id: 'product',
      label: lt.footerProduct,
      href: '#product',
      onSelect: (event) => {
        event.preventDefault();
        controller.goScene('product');
      },
    },
    {
      id: 'store',
      label: lt.footerLiveStore,
      href: '#store',
      onSelect: (event) => {
        event.preventDefault();
        controller.goScene('store');
      },
    },
    { id: 'try-on', label: lt.footerTryOnPage, href: '/try-on' },
    { id: 'pricing', label: lt.footerPricing, href: '/pricing' },
    { id: 'roi', label: lt.footerRoi, href: '/roi' },
    { id: 'security', label: lt.footerSecurity, href: '/security' },
  ];

  const trace = (key: keyof typeof STORY_TRACES) => STORY_TRACES[key].map((line) => t(line));
  const props: SceneProps = { controller, env, common, t };
  const desk = layout === 'desk';

  return (
    <div ref={rootRef} className="gc-story" data-layout={layout}>
      <SkipLink />
      <SiteHeader
        locale={locale}
        copy={siteHeaderCopy(lt)}
        nav={nav}
        menuItems={menu}
        activeId={activeId}
        onSwitchLocale={toggleLocale}
        onBrandClick={(event) => {
          event.preventDefault();
          controller.goTop();
        }}
        onMenuOpenChange={(open) => controller.setMenuOpen(open)}
        phoneExtra={desk ? null : <StoryProgress />}
      />
      {desk ? <StoryRail t={t} onGo={(i) => controller.goSceneIndex(i)} /> : null}
      <StorySprites />
      <div data-k="vhProbe" aria-hidden="true" className="pointer-events-none invisible absolute top-0 h-svh w-px" />
      <main id="main" tabIndex={-1} className="outline-none">
        {SCENE_ORDER.map((scene, index) => (
          <SceneShell key={scene} scene={scene} layout={layout} index={index} traces={trace(FRAME_KEY[scene] as keyof typeof STORY_TRACES)}>
            {scene === 'tryon' ? <TryScene {...props} /> : null}
            {scene === 'store' ? <StoreScene {...props} /> : null}
            {scene === 'ops' ? <OpsScene {...props} /> : null}
            {scene === 'product' ? <ProductScene {...props} /> : null}
            {scene === 'results' ? <ResultsScene {...props} /> : null}
          </SceneShell>
        ))}
        <div data-k="rest" className="gc-story-rest">
          <div data-k="envR" className="gc-story-env">
            <BackgroundWiring trace={trace('R')} lane={false} />
          </div>
          <div className="relative z-[1]">
            {desk ? (
              <>
                <section id="stack" aria-labelledby="stack-title" className="mx-auto max-w-7xl px-10 pt-[130px]">
                  <DeskStack v={common} t={t} />
                </section>
                <section id="journey" data-reveal="" aria-labelledby="journey-title" className="mx-auto max-w-7xl px-10 pt-[130px]">
                  <DeskJourney v={common} t={t} />
                </section>
                {/* The closing band is drawn on a 1440px canvas, centred and clipped at the viewport. */}
                <div className="mt-[140px] overflow-hidden bg-foreground">
                  <div className="relative left-1/2 w-[1440px] -translate-x-1/2">
                    <DeskCta v={common} t={t} />
                  </div>
                </div>
              </>
            ) : (
              <div className="mx-auto w-[390px] max-w-full">
                <section id="chat" data-chat-scene="" aria-labelledby="chat-title" className="px-5 pt-[76px]">
                  <ChatSection {...props} />
                </section>
                <section id="stack" aria-labelledby="stack-title" className="px-5 pt-[76px]">
                  <PhoneStack v={common} t={t} />
                </section>
                <div className="mt-[84px] bg-foreground">
                  <PhoneCta v={common} t={t} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} links={footerLinks} onSwitchLocale={toggleLocale} copy={siteFooterCopy(lt)} />
    </div>
  );
}
