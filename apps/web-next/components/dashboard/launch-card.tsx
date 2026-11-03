'use client';

import { useState, useTransition } from 'react';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { createPreviewLink, setLaunchState } from '@/app/dashboard/try-on/launch-actions';
import type { LaunchState } from '@/lib/launch/audience';

/* Try it yourself, then go live (N5 and N6, phase zero item 9). Shown only
   while the store's n5_preview_mode flag is on. The copy is the
   Today-Setup board's steps 4 and 5 (drafts); the 50/50 choice shows only
   while n6_holdout is on. The board shows step 5 without its controls; the
   two buttons reuse its "Go live" and the Today board's "50/50 test". */

const COPY = {
  en: {
    tryTitle: 'Try it yourself on your store',
    tryBody: 'Try on a piece and ask a question, like a shopper would.',
    testFree: 'Test looks are free.',
    open: 'Open my store',
    liveTitle: 'Go live',
    liveBodyHalf: 'For everyone, or for half your visitors so you can measure the difference.',
    onlyYou: 'Only you see GrindCTRL on your store until you go live.',
    goLive: 'Go live',
    halfTest: '50/50 test',
    holdoutDay: (day: number, days: number) => `50/50 test, day ${day} of ${days}`,
  },
  ar: {
    tryTitle: 'جرّب بنفسك في متجرك',
    tryBody: 'جرّب قطعة واطرح سؤالاً، كما يفعل المتسوق.',
    testFree: 'إطلالات الاختبار مجانية.',
    open: 'افتح متجري',
    liveTitle: 'أطلقه للمتسوقين',
    liveBodyHalf: 'للجميع، أو لنصف زوارك حتى تقيس الفرق.',
    onlyYou: 'لن يرى أحد غيرك GrindCTRL في متجرك حتى تطلقه للمتسوقين.',
    goLive: 'أطلقه للمتسوقين',
    halfTest: 'اختبار 50/50',
    holdoutDay: (day: number, days: number) => `اختبار 50/50، اليوم ${day} من ${days}`,
  },
};

export interface LaunchView {
  /** The state that applies now (a finished holdout reads live). */
  state: LaunchState;
  holdoutDay: number | null;
  holdoutDays: number | null;
}

export function LaunchCard({
  locale,
  shop,
  launch,
  holdoutAvailable,
}: {
  locale: 'en' | 'ar';
  shop: string;
  launch: LaunchView;
  holdoutAvailable: boolean;
}) {
  const t = COPY[locale];
  const [state, setState] = useState<LaunchState>(launch.state);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const live = state === 'live';

  function openStore() {
    setError(null);
    // Opened at once, so the browser does not block it as a pop-up, then
    // pointed at the signed link.
    const tab = window.open('about:blank', '_blank');
    startTransition(async () => {
      const result = await createPreviewLink({ shop });
      if (result.ok) {
        if (tab) {
          tab.opener = null;
          tab.location.href = result.url;
        } else {
          window.location.href = result.url;
        }
      } else {
        tab?.close();
        setError(result.message);
      }
    });
  }

  function choose(next: 'live' | 'holdout') {
    setError(null);
    startTransition(async () => {
      const result = await setLaunchState({ shop, state: next });
      if (result.ok) setState(result.state);
      else setError(result.message);
    });
  }

  return (
    <Paper withBorder radius="card" p="lg" data-testid="launch-card">
      <Stack gap="lg">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Stack gap={4} style={{ minWidth: 0, flex: '1 1 16rem' }}>
            <Text fw={600} size="sm">{t.tryTitle}</Text>
            <Text size="sm" c="dimmed">
              {t.tryBody} <Text span fw={500} c="var(--foreground)">{t.testFree}</Text>
            </Text>
          </Stack>
          <Button type="button" variant="default" radius="pill" h={44} disabled={pending} onClick={openStore}>
            {t.open}
          </Button>
        </Group>

        <Group justify="space-between" gap="sm" wrap="wrap">
          <Stack gap={4} style={{ minWidth: 0, flex: '1 1 16rem' }}>
            <Group gap="xs" wrap="nowrap">
              {live && <GcIcon name="check" size={16} />}
              <Text fw={600} size="sm">{t.liveTitle}</Text>
            </Group>
            {state === 'holdout' && launch.holdoutDay !== null && launch.holdoutDays !== null ? (
              <Text size="sm" c="dimmed" role="status">
                {t.holdoutDay(launch.holdoutDay, launch.holdoutDays)}
              </Text>
            ) : !live ? (
              <Text size="sm" c="dimmed">{holdoutAvailable ? t.liveBodyHalf : t.onlyYou}</Text>
            ) : null}
            {!live && state !== 'holdout' && holdoutAvailable && (
              <Text size="sm" c="dimmed">{t.onlyYou}</Text>
            )}
          </Stack>
          {!live && (
            <Group gap="xs" wrap="wrap">
              <Button type="button" radius="pill" h={44} disabled={pending} onClick={() => choose('live')}>
                {t.goLive}
              </Button>
              {holdoutAvailable && state !== 'holdout' && (
                <Button type="button" variant="default" radius="pill" h={44} disabled={pending} onClick={() => choose('holdout')}>
                  {t.halfTest}
                </Button>
              )}
            </Group>
          )}
        </Group>

        {error && (
          <Text size="sm" c="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
