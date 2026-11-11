'use client';

import * as React from 'react';
import Link from 'next/link';
import { Accordion, Badge, Button, Group, Loader, Radio, SegmentedControl, Text, TextInput } from '@mantine/core';
import { getPlacementCopy } from '@/lib/dashboard/tryon-studio-copy';
import { validSpotSelector, type ButtonPlacement as Placement, type PlacementMode, type SpotPosition } from '@/lib/try-on/placement';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import type { PickLinkResult, PlacementReadResult, PlacementSetResult } from '@/app/dashboard/try-on/placement-actions';
import classes from './button-placement.module.css';

/* Button placement on Try-On Set up (Pack B, B1 and B2): automatic, a spot
   picked on the live store, or floating. Picking happens in a new tab on the
   store; this section reads the setting every 5 seconds while that tab is
   open (30 minutes at most, the link's life) and shows the saved spot by
   itself. */

export type PlacementActions = {
  read: (input: { shop: string }) => Promise<PlacementReadResult>;
  set: (input: { shop: string; placement: PlacementMode }) => Promise<PlacementSetResult>;
  open: (input: { shop: string; advanced?: { selector: string; position: SpotPosition } | null }) => Promise<PickLinkResult>;
};

export const PICK_POLL_MS = 5_000;
export const PICK_WATCH_MS = 30 * 60 * 1000;
const MODES: readonly PlacementMode[] = ['auto', 'spot', 'floating'];

type Handoff = { state: 'idle' } | { state: 'opening' } | { state: 'waiting'; url: string; blocked: boolean };

const sameSpot = (a: Placement['spot'], b: Placement['spot']) =>
  (a?.selector ?? null) === (b?.selector ?? null) && (a?.position ?? null) === (b?.position ?? null) &&
  (a?.pathHint ?? null) === (b?.pathHint ?? null) && (a?.label ?? null) === (b?.label ?? null);

export function ButtonPlacement({
  shop,
  locale,
  actions,
  loadFailed,
}: {
  shop: string;
  locale: SiteLocale;
  actions: PlacementActions;
  /** Shown when the setting could not be read (the studio's own message). */
  loadFailed: string;
}) {
  const copy = getPlacementCopy(locale);
  const [value, setValue] = React.useState<Placement | null>(null);
  const [choice, setChoice] = React.useState<PlacementMode>('auto');
  const [loadError, setLoadError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  /* no_address: the store has no confirmed address to open yet, so the
     merchant is sent to Store setup instead of being told to retry. */
  const [error, setError] = React.useState<false | 'failed' | 'no_address'>(false);
  const [handoff, setHandoff] = React.useState<Handoff>({ state: 'idle' });
  const [selector, setSelector] = React.useState('');
  const [position, setPosition] = React.useState<SpotPosition>('after');
  const watch = React.useRef<{ timer: ReturnType<typeof setInterval> } | null>(null);
  const mounted = React.useRef(true);

  function apply(next: Placement) {
    setValue(next);
    setChoice(next.placement);
    if (next.spot) {
      setSelector(next.spot.selector);
      setPosition(next.spot.position);
    }
  }

  function stopWatching() {
    if (watch.current) clearInterval(watch.current.timer);
    watch.current = null;
  }

  const loaded = React.useEffectEvent((result: PlacementReadResult | null) => {
    if (result?.ok) apply(result.placement);
    else setLoadError(true);
  });

  React.useEffect(() => {
    mounted.current = true;
    actions.read({ shop }).then((result) => { if (mounted.current) loaded(result); }, () => { if (mounted.current) loaded(null); });
    return () => {
      mounted.current = false;
      if (watch.current) clearInterval(watch.current.timer);
      watch.current = null;
    };
  }, [actions, shop]);

  async function choose(mode: PlacementMode) {
    if (busy || !value || mode === choice) return;
    // A spot is saved from the store tab; until then the store keeps its current placement.
    if ((mode === 'spot' && !value.spot) || mode === value.placement) { setChoice(mode); setError(false); return; }
    const previous = choice;
    setChoice(mode);
    setBusy(true);
    setError(false);
    const result = await actions.set({ shop, placement: mode }).catch(() => null);
    if (!mounted.current) return;
    setBusy(false);
    if (result?.ok) apply(result.placement);
    else { setChoice(previous); setError('failed'); }
  }

  function startWatching(popup: Window | null, expiresAt: string, before: Placement['spot']) {
    stopWatching();
    const deadline = Math.min(Date.parse(expiresAt) || 0, Date.now() + PICK_WATCH_MS);
    let reading = false;
    const timer = setInterval(async () => {
      if (Date.now() >= deadline || (popup && popup.closed)) {
        stopWatching();
        if (mounted.current) setHandoff({ state: 'idle' });
        // A save made just before the tab closed is still shown.
        if (popup?.closed) actions.read({ shop }).then((result) => { if (mounted.current && result.ok) apply(result.placement); }, () => {});
        return;
      }
      if (reading) return;
      reading = true;
      const result = await actions.read({ shop }).catch(() => null);
      reading = false;
      if (!mounted.current || !watch.current || !result?.ok) return;
      if (result.placement.spot && !sameSpot(result.placement.spot, before)) {
        apply(result.placement);
        stopWatching();
        setHandoff({ state: 'idle' });
      }
    }, PICK_POLL_MS);
    watch.current = { timer };
  }

  async function openPick(advanced: boolean) {
    if (busy || !value || (advanced && !validSpotSelector(selector))) return;
    // Opened inside the click so phones and popup blockers allow it; filled once the link exists.
    const popup = window.open('', '_blank');
    setBusy(true);
    setError(false);
    setHandoff({ state: 'opening' });
    const result = await actions.open({ shop, advanced: advanced ? { selector, position } : null }).catch(() => null);
    if (!mounted.current) { popup?.close(); return; }
    setBusy(false);
    if (!result?.ok) {
      popup?.close();
      setHandoff({ state: 'idle' });
      setError(result && 'reason' in result && result.reason === 'no_store_address' ? 'no_address' : 'failed');
      return;
    }
    if (popup) {
      // The store page gets no handle back to the dashboard.
      popup.opener = null;
      popup.location.href = result.url;
    }
    setHandoff({ state: 'waiting', url: result.url, blocked: !popup });
    startWatching(popup, result.expiresAt, value.spot);
  }

  if (loadError) {
    return (
      <section id="button-placement" className={classes.section} aria-labelledby="button-placement-title">
        <h2 id="button-placement-title" className={classes.title}>{copy.section}</h2>
        <Text size="sm" role="alert" className={classes.error}>{loadFailed}</Text>
      </section>
    );
  }

  const loading = value === null;
  const subtitle: Record<PlacementMode, string> = { auto: copy.autoSub, spot: copy.spotSub, floating: copy.floatingSub };
  const savedParts = value?.spot ? copy.saved(value.spot.position, '\u0000').split('\u0000') : ['', ''];

  return (
    <section id="button-placement" className={classes.section} aria-labelledby="button-placement-title" aria-busy={loading || busy}>
      <h2 id="button-placement-title" className={classes.title}>{copy.section}</h2>
      <Radio.Group value={choice} onChange={(mode) => void choose(mode as PlacementMode)} aria-labelledby="button-placement-title">
        <div className={classes.choices}>
          {MODES.map((mode) => (
            <React.Fragment key={mode}>
              <Radio.Card value={mode} className={classes.choice} radius="md" disabled={loading || busy}>
                <Group wrap="nowrap" align="flex-start" gap="sm">
                  <Radio.Indicator mt={2} disabled={loading || busy} />
                  <div className={classes.choiceText}>
                    <span className={classes.choiceTitle}>
                      <Text fw={600} size="sm" component="span">{copy[mode]}</Text>
                      {mode === 'auto' ? <Badge variant="light" size="sm" radius="xl">{copy.recommended}</Badge> : null}
                    </span>
                    <Text size="xs" c="dimmed">{subtitle[mode]}</Text>
                    {mode === 'floating' ? (
                      <span className={classes.miniPage} aria-hidden="true">
                        <span className={classes.miniPill} />
                        <span className={classes.miniChat} />
                      </span>
                    ) : null}
                  </div>
                </Group>
              </Radio.Card>
              {/* The saved spot and the hand-off to the store tab belong to the spot card. */}
              {mode === 'spot' ? (
                <div className={classes.spotDetail}>
                  {choice === 'spot' && value ? (
                    <div className={classes.spot}>
                      {value.spot ? (
                        <Text size="sm" className={classes.savedSpot} role="status">
                          {/* <bdi>: a label in another script keeps the quotes around it in place. */}
                          {savedParts[0]}<bdi>{value.spot.label}</bdi>{savedParts[1]}
                        </Text>
                      ) : null}
                      <Group gap="xs">
                        <Button radius="pill" onClick={() => void openPick(false)} disabled={busy} loading={handoff.state === 'opening'}>
                          {value.spot ? copy.change : copy.pick}
                        </Button>
                        {value.spot ? (
                          <Button radius="pill" variant="subtle" onClick={() => void choose('auto')} disabled={busy}>
                            {copy.reset}
                          </Button>
                        ) : null}
                      </Group>
                    </div>
                  ) : null}
                  {handoff.state !== 'idle' ? (
                    <div className={classes.handoff} role="status">
                      {handoff.state === 'opening' ? <Loader size="xs" aria-hidden="true" /> : null}
                      <Text size="sm" component="span">{handoff.state === 'opening' ? copy.opening : copy.finish}</Text>
                      {handoff.state === 'waiting' && handoff.blocked ? (
                        <Button component="a" href={handoff.url} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="light" radius="pill">
                          {copy.pick}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </Radio.Group>

      {error === 'no_address' ? (
        <div role="alert" className={classes.handoff}>
          <Text size="sm" component="span" className={classes.error}>{copy.noAddress}</Text>
          <Button component={Link} href="/dashboard/store" size="compact-sm" variant="light" radius="pill">{copy.noAddressAction}</Button>
        </div>
      ) : error ? <Text size="sm" role="alert" className={classes.error}>{copy.failed}</Text> : null}

      <Accordion
        variant="default"
        className={classes.advanced}
        classNames={{ item: classes.advancedItem, control: classes.advancedControl, content: classes.advancedContent }}
      >
        <Accordion.Item value="advanced">
          <Accordion.Control>{copy.advanced}</Accordion.Control>
          <Accordion.Panel>
            <div className={classes.advancedBody}>
              <TextInput
                label={copy.selector}
                value={selector}
                maxLength={300}
                dir="ltr"
                spellCheck={false}
                autoComplete="off"
                classNames={{ input: classes.code }}
                onChange={(event) => setSelector(event.currentTarget.value)}
              />
              <SegmentedControl
                aria-label={copy.section}
                value={position}
                onChange={(next) => setPosition(next as SpotPosition)}
                data={[{ value: 'before', label: copy.above }, { value: 'after', label: copy.below }]}
              />
              <Button
                variant="default"
                radius="pill"
                className={classes.test}
                disabled={loading || busy || !validSpotSelector(selector)}
                onClick={() => void openPick(true)}
              >
                {copy.test}
              </Button>
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </section>
  );
}
