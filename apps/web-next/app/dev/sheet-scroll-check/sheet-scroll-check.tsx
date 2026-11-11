'use client';

import { useEffect, useState } from 'react';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { TryOnSheetView, type SheetFlow } from '@/components/try-on/sheet/try-on-sheet';
import { MessengerPanel } from '@/components/messenger/MessengerPanel';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';
import { getDictionary } from '@/lib/try-on/i18n';
import { makingProgress } from '@/lib/try-on/making-progress';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import { PHOTO, DARK_PHOTO, LOOK, PRODUCT, LONG_PRODUCT, LONG_PRODUCT_AR, STORE_PRODUCT, TRIED_VARIANT, chatMessages, type FixtureState } from './fixtures';

const noop = () => {};
const config: PublicMessengerPayload = {
  v: 3, key: 'gc_scroll_fixture', storeName: 'Maison Noor', active: true, available: true,
  aiEnabled: true, attachmentsEnabled: true, features: ['v16_chat'], orderLookup: true, contactCapture: true,
  appearance: { accentColor: '#2a2826', launcherIcon: 'chat', launcherCustomIconUrl: null,
    launcherLabel: { en: 'Support', ar: 'الدعم' }, launcherSizePx: 56, languageMode: 'auto',
    position: 'bottom-right', radiusStyle: 'soft', themeMode: 'light', assistantAvatarUrl: null },
  behaviour: {
    welcomeTitle: { en: 'Hi! How can we help?', ar: 'مرحباً! كيف نقدر نساعدك؟' },
    welcomeSubtitle: { en: 'Ask us anything.', ar: 'اسألنا أي شيء.' },
    inputPlaceholder: { en: 'Ask anything…', ar: 'اكتب سؤالك…' },
    greetingEnabled: false, greetingDelaySeconds: 5, greeting: { en: '', ar: '' },
    proactiveEnabled: false, proactiveDelaySeconds: 5, targetingMode: 'everywhere', excludePatterns: [],
  },
};

export function SheetScrollCheck({ state, locale, long, dark }: {
  state: FixtureState; locale: 'en' | 'ar'; long: boolean; dark: boolean;
}) {
  const [privacyOpen, setPrivacyOpen] = useState(state === 'privacy');
  const [keep, setKeep] = useState(true);
  const copy = getSheetCopy(locale);
  const t = getDictionary(locale);
  // Mirror the real document's locale/theme, including portal content. The
  // fixture itself has no fetches and never initializes useTryOnFlow.
  useEffect(() => {
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    document.documentElement.classList.toggle('dark', dark);
  }, [locale, dark]);
  const flow: SheetFlow = {
    step: ['error', 'challenge', 'out-of-looks'].includes(state) ? 'error'
      : ['result', 'result-compare', 'size'].includes(state) ? 'result'
      : state === 'making' ? 'generating' : ['check', 'check-issue'].includes(state) ? 'consent' : 'upload',
    photoDataUrl: state === 'check-issue' ? DARK_PHOTO : PHOTO,
    sessionState: state === 'session-error' ? 'error' : 'ready',
    sessionError: t.genericError, error: t.genericError,
    unavailable: state === 'out-of-looks', challengeFailed: state === 'challenge', generationSeconds: 18,
    job: { jobId: 'fixture', sessionId: 'fixture', productId: PRODUCT.handle, shop: null, status: 'completed',
      resultImageUrl: LOOK, createdAt: '2026-11-11T09:00:00Z', meta: { runtime: 'mock', provider: 'fixture', costEstimate: null } },
    selectPhoto: noop, acceptPhoto: noop, clearPhoto: noop, retrySession: noop, reset: noop,
    generate: async () => {}, forget: async () => {}, discardBrokenLook: async () => {},
  };
  const product = long ? locale === 'ar' ? LONG_PRODUCT_AR : LONG_PRODUCT : PRODUCT;
  const tips = [copy.tipFullLength, copy.tipHijab, copy.tipLight];
  return <div className={`gc-embed-document bg-background text-foreground ${dark ? 'dark' : ''}`} data-scroll-fixture={state}>
    {state === 'chat' ? <div style={{ blockSize: '100dvh' }}>
      <MessengerPanel variant="preview" previewChrome config={{ ...config, appearance: { ...config.appearance, themeMode: dark ? 'dark' : 'light' } }}
        locale={locale} previewMessages={chatMessages(locale)} />
    </div> : <TryOnLocaleProvider initialLocale={locale}>
      <TryOnSheetView copy={copy} t={t} locale={locale} product={product} variantTitle="Black / M"
        lookSeconds={20} inApp={state === 'inapp' ? { app: 'Instagram', os: 'ios' } : null}
        storeLink="https://store.example/products/layla-abaya" canTakePhoto phoneRead privacyOpen={privacyOpen}
        onPrivacyOpenChange={setPrivacyOpen} firstTime keepOnPhone={keep} onKeepOnPhone={setKeep} onTryOn={noop}
        flow={flow} steps={copy.makingSteps} progress={makingProgress({ elapsedMs: 8000, estimateSeconds: 20, stepCount: copy.makingSteps.length, stage: 'making' })}
        storeProduct={state === 'size' ? STORE_PRODUCT : null} triedVariantId={TRIED_VARIANT}
        initialResultView={state === 'result-compare' ? 'photo' : 'look'} photoTips={long ? [...tips, ...tips] : undefined} />
    </TryOnLocaleProvider>}
  </div>;
}
