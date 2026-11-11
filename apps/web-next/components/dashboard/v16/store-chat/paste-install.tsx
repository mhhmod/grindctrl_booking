'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Code, CopyButton, Group, PasswordInput, Radio, Stack, Text, TextInput } from '@mantine/core';
import { ShopifyLogo, WooCommerceLogo, WordPressMark } from '@/components/brand-marks';
import { GcIcon } from '@/components/icons';
import type { InstallPlatform, PasteInstallCopy } from '@/lib/dashboard/paste-install-copy';
import type { PasteInstallStatus } from '@/lib/paste/status';
import type {
  PasteConflictHolder, PasteDomain, PasteDomainCheck, PasteErrorCode, PastePlatform, PasteResult, PasteShopCheckOutcome, PasteShopProof,
  PasteSnippet,
} from '@/lib/paste/types';
import classes from './paste-install.module.css';

export type PasteInstallActions = {
  enable(siteId: string, platform: PastePlatform, shopDomain?: string): Promise<PasteResult<{ tenantKey: string }>>;
  addDomain(siteId: string, domain: string): Promise<PasteResult<PasteDomain>>;
  removeDomain(siteId: string, domainId: string): Promise<PasteResult<null>>;
  proveDns(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>>;
  proveMeta(siteId: string, domainId: string): Promise<PasteResult<PasteDomain>>;
  rotate(siteId: string): Promise<PasteResult<{ version: number; overlapUntil: string }>>;
  snippet(siteId: string): Promise<PasteResult<PasteSnippet>>;
  status(siteId: string): Promise<PasteResult<PasteInstallStatus>>;
  proveShop(siteId: string, storefrontPassword?: string): Promise<PasteResult<PasteShopProof>>;
  checkDomain(siteId: string, domainId: string): Promise<PasteResult<PasteDomainCheck>>;
  /** Owner only: undo the pasted install to connect another store. */
  disconnect?(siteId: string): Promise<PasteResult<null>>;
};

const POLL_MS = 5000;
const LIVE_WINDOW_MS = 30 * 60 * 1000;
const SUPPORT_EMAIL = 'grindctrlnow@gmail.com';

function minutesSince(iso: string | null, now: number): number | null {
  return iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / 60000)) : null;
}

function shopDomain(input: string): string {
  const value = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return value && !value.includes('.') ? `${value}.myshopify.com` : value;
}

/** Paste-code install: choose a platform, add the store address, copy the
 *  code, paste it, and watch it go live. WooCommerce keeps its plugin guide. */
export function PasteInstall({
  siteId,
  locale,
  copy,
  ago,
  actions,
  woocommerce,
  initialPlatform = null,
}: {
  siteId: string;
  locale: string;
  copy: PasteInstallCopy;
  ago: (minutes: number) => string;
  actions: PasteInstallActions;
  woocommerce: React.ReactNode;
  initialPlatform?: InstallPlatform | null;
}) {
  const [picked, setPlatform] = React.useState<InstallPlatform | null>(initialPlatform);
  const [status, setStatus] = React.useState<PasteInstallStatus | null>(null);
  const [snippet, setSnippet] = React.useState<PasteSnippet | null>(null);
  const [error, setError] = React.useState<PasteErrorCode | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [shop, setShop] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [proofFor, setProofFor] = React.useState<string | null>(null);
  const [resetStep, setResetStep] = React.useState<'idle' | 'confirm'>('idle');
  const [resetUntil, setResetUntil] = React.useState<string | null>(null);
  /* Read when status arrives, so render stays pure. */
  const [now, setNow] = React.useState(0);
  const [stepsOpen, setStepsOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [checked, setChecked] = React.useState<{ outcome: PasteShopCheckOutcome | 'rate_limited'; retryAfter: number | null; at: number } | null>(null);
  /* What the check that found the code saw on the storefront: a product page
     to open, and whether a password page stood in front. Not stored, so it
     lasts for this visit to the dashboard. */
  const [storefront, setStorefront] = React.useState<NonNullable<PasteShopProof['storefront']> | null>(null);
  /* A domain check that could not run this time (rate limited). */
  const [domainWait, setDomainWait] = React.useState<{ id: string; retryAfter: number | null } | null>(null);
  /* Which connection holds the store, when enabling was refused. */
  const [heldBy, setHeldBy] = React.useState<PasteConflictHolder | null>(null);
  /* "Use a different store": where its confirmation shows, and its outcome. */
  const [leaving, setLeaving] = React.useState<{ at: 'alert' | 'step'; store: string | null } | null>(null);
  const [released, setReleased] = React.useState(false);
  const router = useRouter();

  const run = React.useCallback(async <T,>(key: string, call: () => Promise<PasteResult<T>>): Promise<T | null> => {
    setBusy(key);
    setError(null);
    setHeldBy(null);
    setReleased(false);
    try {
      const result = await call();
      if (!result.ok) {
        setError(result.code);
        setHeldBy(result.heldBy ?? null);
        return null;
      }
      return result.data;
    } catch {
      setError('unavailable');
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  type Loaded = { status: PasteResult<PasteInstallStatus> | null; snippet: PasteResult<PasteSnippet> | null };
  const load = React.useCallback(async (): Promise<Loaded> => {
    const next = await actions.status(siteId).catch(() => null);
    /* Shopify is trusted through its signed shop; websites need an address
       first. Any address will do: pasting the code is also how an address
       another account holds moves here. */
    const ready = next?.ok && next.data.connected
      && (next.data.platform === 'shopify' || next.data.domains.some((d) => d.state !== 'disputed'));
    return { status: next, snippet: ready ? await actions.snippet(siteId).catch(() => null) : null };
  }, [actions, siteId]);

  const apply = React.useCallback((loaded: Loaded) => {
    const next = loaded.status;
    if (!next) return;
    if (!next.ok) {
      if (next.code === 'schema_not_ready') setError('schema_not_ready');
      return;
    }
    setNow(Date.now());
    setStatus(next.data);
    if (loaded.snippet?.ok) setSnippet(loaded.snippet.data);
  }, []);

  const refresh = React.useCallback(async () => apply(await load()), [apply, load]);

  React.useEffect(() => {
    let live = true;
    void load().then((loaded) => {
      if (live) apply(loaded);
    });
    return () => {
      live = false;
    };
  }, [apply, load]);

  /* Keep watching while the merchant pastes, and after the first signal
     until Try-On settles (the free looks are granted a moment later). */
  const settling = status?.tryOnReason === 'not_installed' || status?.tryOnReason === 'shop_proof_pending'
    || status?.tryOnReason === 'domain_unverified';
  /* Our server confirms an address by itself once the code is live. */
  const confirming = Boolean(status?.domains.some((d) => !d.domainVerified && d.state !== 'disputed'));
  /* Installed once our code has ever run on the store. "seen" alone means the
     last 30 minutes, which a quiet store falls out of while it is working. */
  const everSeen = Boolean(status?.seen || status?.shopLastSeenAt || status?.shopProof === 'proven'
    || status?.domains.some((d) => d.state === 'trusted' && d.lastSeenAt));
  const waiting = Boolean(snippet) && (!everSeen || confirming || (!status?.tryOnReady && settling));
  React.useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, refresh]);

  const connectedAs = status?.connected ? status.platform : null;
  /* A connected store opens on its own platform until the merchant picks another. */
  const platform = picked ?? connectedAs ?? null;
  const domains = status?.domains ?? [];

  async function choose(next: InstallPlatform) {
    setPlatform(next);
    setError(null);
    if (next === 'website' && connectedAs !== 'website') {
      if (await run('enable', () => actions.enable(siteId, 'website'))) await refresh();
    }
  }

  async function connectShopify(event: React.FormEvent) {
    event.preventDefault();
    const value = shopDomain(shop);
    if (await run('enable', () => actions.enable(siteId, 'shopify', value))) await refresh();
  }

  async function addDomain(event: React.FormEvent) {
    event.preventDefault();
    if (!domain.trim()) return;
    if (await run('domain', () => actions.addDomain(siteId, domain.trim()))) {
      setDomain('');
      await refresh();
    }
  }

  async function reset() {
    const data = await run('reset', () => actions.rotate(siteId));
    setResetStep('idle');
    if (!data) return;
    setResetUntil(new Date(data.overlapUntil).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }));
    await refresh();
  }

  async function checkDomain(domainId: string) {
    const result = await run(`check:${domainId}`, () => actions.checkDomain(siteId, domainId));
    setDomainWait(result?.outcome === 'rate_limited' ? { id: domainId, retryAfter: result.retryAfterSeconds } : null);
    if (result) await refresh();
  }

  async function checkStore(event: React.FormEvent) {
    event.preventDefault();
    const typed = password.trim();
    const result = await run('check', () => actions.proveShop(siteId, typed || undefined));
    setPassword('');
    if (result) {
      setChecked({ outcome: result.outcome, retryAfter: result.retryAfterSeconds, at: Date.now() });
      if (result.storefront) setStorefront(result.storefront);
    }
    await refresh();
  }

  async function leave() {
    const disconnect = actions.disconnect;
    if (!disconnect) return;
    const was = connectedAs;
    // Its data is null on success, so success is read from `ok`.
    const left = await run('leave', async () => {
      const result = await disconnect(siteId);
      return result.ok ? { ok: true as const, data: true } : result;
    });
    if (!left) return;
    setLeaving(null);
    setSnippet(null);
    setChecked(null);
    setStorefront(null);
    setStepsOpen(false);
    // Straight back to the same platform's first step: usually the address was wrong.
    setPlatform((current) => current ?? was);
    setReleased(true);
    await refresh();
    router.refresh();
  }

  const liveDomain = domains.find((d) => d.state === 'trusted' && d.lastSeenAt && now - Date.parse(d.lastSeenAt) <= LIVE_WINDOW_MS);
  const shopifyDomain = connectedAs === 'shopify' ? status?.shopDomain ?? undefined : undefined;
  const lastSeenDomain = domains.filter((d) => d.state === 'trusted' && d.lastSeenAt)
    .sort((a, b) => Date.parse(b.lastSeenAt!) - Date.parse(a.lastSeenAt!))[0];
  const storeHost = status?.seenHost ?? liveDomain?.domain ?? lastSeenDomain?.domain ?? domains.find((d) => d.state === 'trusted')?.domain ?? shopifyDomain;
  const lastSeenAt = lastSeenDomain?.lastSeenAt ?? status?.shopLastSeenAt ?? null;
  const storeUrl = `https://${storeHost ?? ''}`;
  /* Our code has run on the store: the install part is done. */
  const installed = everSeen && status?.connectionReason !== 'shopify_app_installed';
  /* The owner's own check answers until the store records a newer one (a
     product page visit runs a check of its own). */
  const ownCheck = checked && !(Date.parse(status?.shopCheck?.checkedAt ?? '') > checked.at) ? checked : null;
  const shopOutcome = ownCheck?.outcome ?? status?.shopCheck?.outcome ?? null;
  const shopRetryAfter = ownCheck ? ownCheck.retryAfter : status?.shopCheck?.retryAfterSeconds ?? null;
  const passwordAsked = shopOutcome === 'password_required' || shopOutcome === 'password_rejected';
  /* Shopify: a product page is where the signed render, Store Chat and the
     button all show, so that is the page to open. Without a product link
     from this visit's check, the store's all-products page is one tap away
     from one (its home page may be the password page). */
  const productUrl = connectedAs === 'shopify' ? storefront?.productUrl ?? null : null;
  const visitUrl = productUrl ?? (connectedAs === 'shopify' && storeHost ? `${storeUrl}/collections/all` : storeUrl);
  const visitLabel = productUrl ? copy.openProductPage : connectedAs === 'shopify' ? copy.openProducts : copy.openStore;
  const passwordPage = connectedAs === 'shopify' && (passwordAsked || Boolean(storefront?.passwordPage));

  /* Success shows without a reload: when the store turns installed (and a
     Shopify shop proven), the server-drawn parts of the page are read again. */
  const done = installed && (connectedAs !== 'shopify' || status?.shopProof === 'proven');
  const wasDone = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (!status) return;
    if (wasDone.current === false && done) router.refresh();
    wasDone.current = done;
  }, [status, done, router]);

  const leaveConfirm = (store: string | null) => (
    <Stack gap="xs" className={classes.proof} role="group" aria-label={copy.leaveAction}>
      <Text size="sm">{copy.leaveBody(store)}</Text>
      <Group gap="xs">
        <Button color="red" size="compact-sm" radius="pill" loading={busy === 'leave'} onClick={() => void leave()}>
          {copy.leaveConfirm}
        </Button>
        <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setLeaving(null)}>
          {copy.cancel}
        </Button>
      </Group>
    </Stack>
  );

  return (
    <Stack gap="lg" className={classes.root}>
      {installed && status ? (
        /* The moment it works, say so plainly and point at what to do next. */
        <section className={classes.success} aria-live="polite">
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <span className={classes.successMark} aria-hidden="true"><GcIcon name="check" size={18} /></span>
            <Stack gap={4} className={classes.grow}>
              <Text fw={700}>{copy.installedTitle(status.seenHost ?? storeHost ?? '')}</Text>
              <Text size="sm">{status.chatLive ? copy.chatShown : copy.chatPreview}</Text>
              <Text size="sm">
                {status.showButton === false
                  ? copy.tryOnOff
                  : status.tryOnReady ? copy.tryOnOn(Math.max(0, status.plan?.totalCreditsRemaining ?? 0)) : copy.tryOnReason(status.tryOnReason)}
              </Text>
              {passwordPage ? <Text size="sm">{copy.passwordPageNote}</Text> : null}
            </Stack>
          </Group>
          {status.codeOutdated ? (
            <Alert variant="light" mt="sm" icon={<GcIcon name="spark" size={18} />}>
              <Stack gap={6} align="flex-start">
                <Text size="sm">{copy.codeOutdated}</Text>
                <Button size="xs" radius="pill" variant="default" onClick={() => setStepsOpen(true)}>
                  {copy.codeOutdatedAction}
                </Button>
              </Stack>
            </Alert>
          ) : null}
          <Group gap="xs" mt="sm">
            <Button component="a" href={visitUrl} target="_blank" rel="noopener noreferrer" radius="pill" size="sm" rightSection={<GcIcon name="ext" size={14} />}>
              {copy.seeOnStore}
            </Button>
            <Button component={Link} href="/dashboard/try-on" variant="default" radius="pill" size="sm">
              {copy.goTryOnSetup}
            </Button>
          </Group>
        </section>
      ) : (
        <div>
          <Text fw={700}>{copy.title}</Text>
          <Text size="sm" c="dimmed">{copy.intro}</Text>
        </div>
      )}

      {!installed || stepsOpen ? (
      <Radio.Group value={platform} onChange={(value) => void choose(value as InstallPlatform)} label={copy.platformLegend}>
        <div className={classes.platforms}>
          {(['shopify', 'woocommerce', 'website'] as const).map((key) => (
            <Radio.Card key={key} value={key} className={classes.platform} radius="md">
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <Radio.Indicator mt={2} />
                <div className={classes.platformText}>
                  <span className={classes.logo} aria-hidden="true">
                    {key === 'shopify' ? <ShopifyLogo size={20} /> : key === 'woocommerce' ? <><WordPressMark className={classes.wpMark} decorative /><WooCommerceLogo size={14} /></> : <GcIcon name="store" size={20} />}
                  </span>
                  <Text fw={600} size="sm">{copy.platforms[key].name}</Text>
                  <Text size="xs" c="dimmed">{copy.platforms[key].body}</Text>
                </div>
              </Group>
            </Radio.Card>
          ))}
        </div>
      </Radio.Group>
      ) : null}

      {error ? (
        <Alert color="red" variant="light" role="alert" icon={<GcIcon name="warn" size={18} />}>
          <Stack gap="xs" align="flex-start">
            <span>{error === 'connection_conflict' && heldBy ? copy.conflict(heldBy) : copy.errors[error]}</span>
            {/* Held by this account's own pasted code: the way out is right here. */}
            {heldBy?.kind === 'paste' && actions.disconnect && leaving?.at !== 'alert' ? (
              <Button variant="default" size="compact-sm" radius="pill" onClick={() => setLeaving({ at: 'alert', store: heldBy.store })}>
                {copy.leaveAction}
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {leaving?.at === 'alert' ? leaveConfirm(leaving.store) : null}
      {released ? (
        <Alert variant="light" role="status" icon={<GcIcon name="check" size={18} />}>{copy.leaveDone}</Alert>
      ) : null}

      {platform === 'woocommerce' ? woocommerce : null}

      {status?.connectionReason === 'shopify_app_installed' && platform === 'shopify' ? (
        <Alert variant="light" icon={<GcIcon name="info" size={18} />}>{copy.appHeld}</Alert>
      ) : installed && !stepsOpen ? (
        <Button variant="subtle" size="compact-sm" className={classes.copy} onClick={() => setStepsOpen(true)}>
          {copy.showSteps}
        </Button>
      ) : platform === 'shopify' || platform === 'website' ? (
        <ol className={classes.steps}>
          <li className={classes.step}>
            <Text fw={600}>{copy.steps.address}</Text>
            {platform === 'shopify' && connectedAs !== 'shopify' ? (
              <form onSubmit={connectShopify} className={classes.inline}>
                <TextInput
                  label={copy.shopifyLabel}
                  description={copy.shopifyHint}
                  placeholder={copy.shopifyPlaceholder}
                  value={shop}
                  onChange={(event) => setShop(event.currentTarget.value)}
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  className={classes.grow}
                />
                <Button type="submit" radius="pill" loading={busy === 'enable' || busy === 'domain'} disabled={!shop.trim()}>
                  {copy.shopifyContinue}
                </Button>
              </form>
            ) : (
              <>
                {connectedAs ? (
                  /* B5: a wrong address, or another platform, is undone here. */
                  <Group gap="xs" wrap="wrap" align="center">
                    {connectedAs === 'shopify' && status?.shopDomain ? (
                      <Text size="sm" className={classes.grow}>
                        {copy.connectedTo('\u0000').split('\u0000')[0]}<bdi dir="ltr">{status.shopDomain}</bdi>
                        {copy.connectedTo('\u0000').split('\u0000')[1]}
                      </Text>
                    ) : null}
                    {actions.disconnect && leaving?.at !== 'step' ? (
                      <Button variant="subtle" size="compact-sm" onClick={() => setLeaving({ at: 'step', store: status?.shopDomain ?? null })}>
                        {copy.leaveAction}
                      </Button>
                    ) : null}
                  </Group>
                ) : null}
                {leaving?.at === 'step' ? leaveConfirm(leaving.store) : null}
                <form onSubmit={addDomain} className={classes.inline}>
                  <TextInput
                    label={copy.domainLabel}
                    description={connectedAs === 'shopify' ? copy.shopifyDomainHint : copy.domainHint}
                    placeholder={copy.domainPlaceholder}
                    value={domain}
                    onChange={(event) => setDomain(event.currentTarget.value)}
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    className={classes.grow}
                  />
                  <Button type="submit" variant="default" radius="pill" loading={busy === 'domain'} disabled={!domain.trim() || busy === 'enable'}>
                    {copy.addDomain}
                  </Button>
                </form>
                {domains.length ? (
                  <ul className={classes.domains}>
                    {domains.map((d) => {
                      const seen = minutesSince(d.lastSeenAt, now);
                      const live = d.domainVerified && seen !== null && seen * 60000 <= LIVE_WINDOW_MS;
                      /* DNS or meta tag: for an address another account holds, or
                         a site our check cannot open. Never the first ask. */
                      const proofOffered = d.state !== 'trusted' || d.verificationReason === 'unreachable';
                      const wait = domainWait?.id === d.id ? domainWait : null;
                      return (
                        <li key={d.id} className={classes.domain}>
                          <Group justify="space-between" wrap="nowrap" gap="xs">
                            <Group gap={6} wrap="wrap" className={classes.grow}>
                              <span dir="ltr" className={classes.domainName}>{d.domain}</span>
                              <Badge
                                variant="light"
                                color={d.state !== 'trusted' ? 'orange' : live ? 'green' : d.domainVerified ? 'gray' : 'yellow'}
                                leftSection={live ? <span className={classes.dot} aria-hidden="true" /> : undefined}
                              >
                                {d.state !== 'trusted' ? copy.domainState.proof : live ? copy.domainState.live(ago(seen ?? 0))
                                  : d.domainVerified ? copy.domainState.verified : copy.domainState.waiting}
                              </Badge>
                            </Group>
                            <Button
                              variant="subtle"
                              color="gray"
                              size="compact-sm"
                              aria-label={copy.removeDomain(d.domain)}
                              loading={busy === `remove:${d.id}`}
                              onClick={async () => {
                                if (await run(`remove:${d.id}`, () => actions.removeDomain(siteId, d.id))) await refresh();
                              }}
                            >
                              <GcIcon name="close" size={16} />
                            </Button>
                          </Group>
                          {d.verificationReason ? (
                            <Group gap="xs" mt={4} wrap="wrap" align="center">
                              <Text size="sm" c="dimmed" role="status" className={classes.grow}>
                                {wait ? copy.shopCheck('rate_limited', wait.retryAfter) : copy.domainReason(d.verificationReason)}
                              </Text>
                              <Button size="xs" radius="pill" variant="default" loading={busy === `check:${d.id}`}
                                onClick={() => void checkDomain(d.id)}>
                                {copy.checkStore}
                              </Button>
                            </Group>
                          ) : null}
                          {proofOffered ? (
                            proofFor === d.id ? (
                              <Stack gap="xs" mt="xs" className={classes.proof}>
                                <Text size="sm">{copy.proofTitle}</Text>
                                <Text size="sm">{copy.proofMeta}</Text>
                                <CodeLine value={`<meta name="${d.proof.meta.name}" content="${d.proof.meta.content}">`} copy={copy} />
                                <Button size="xs" radius="pill" variant="default" loading={busy === `meta:${d.id}`} onClick={async () => {
                                  if (await run(`meta:${d.id}`, () => actions.proveMeta(siteId, d.id))) await refresh();
                                }}>
                                  {copy.check}
                                </Button>
                                <Text size="sm">{copy.proofDns}</Text>
                                <Text size="xs" c="dimmed">{copy.proofDnsName}</Text>
                                <CodeLine value={d.proof.txtName} copy={copy} />
                                <Text size="xs" c="dimmed">{copy.proofDnsValue}</Text>
                                <CodeLine value={d.proof.txtValue} copy={copy} />
                                <Button size="xs" radius="pill" variant="default" loading={busy === `dns:${d.id}`} onClick={async () => {
                                  if (await run(`dns:${d.id}`, () => actions.proveDns(siteId, d.id))) await refresh();
                                }}>
                                  {copy.check}
                                </Button>
                              </Stack>
                            ) : (
                              <Button variant="subtle" size="compact-sm" mt={4} onClick={() => setProofFor(d.id)}>
                                {copy.otherProof}
                              </Button>
                            )
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </li>

          <li className={classes.step}>
            <Text fw={600}>{copy.steps.code}</Text>
            {snippet ? (
              <Stack gap="xs">
                <Code block dir="ltr" className={classes.code}>{snippet.snippet}</Code>
                <CopyButton value={snippet.snippet} timeout={2000}>
                  {({ copied, copy: doCopy }) => (
                    <Button onClick={doCopy} radius="pill" className={classes.copy} leftSection={<GcIcon name={copied ? 'check' : 'doc'} size={16} />}>
                      {copied ? copy.copied : copy.copyCode}
                    </Button>
                  )}
                </CopyButton>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">{copy.codeLocked}</Text>
            )}
          </li>

          <li className={classes.step}>
            <Text fw={600}>{copy.steps.paste}</Text>
            {snippet ? (
              <ol className={classes.pasteSteps}>
                {snippet.steps.map((step, index) => (
                  <li key={index}>
                    <Text size="sm">{copy.pasteSteps(step)}</Text>
                    {step.kind === 'open' && step.target === 'shopify_theme_editor' && shopifyDomain ? (
                      <Button
                        component="a"
                        href={`https://${shopifyDomain}/admin/themes/current/editor`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="default"
                        radius="pill"
                        size="xs"
                        mt={6}
                        rightSection={<GcIcon name="ext" size={14} />}
                      >
                        {copy.openThemeEditor}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <Text size="sm" c="dimmed">{copy.codeLocked}</Text>
            )}
          </li>

          <li className={classes.step} aria-live="polite">
            <Text fw={600}>{copy.steps.live}</Text>
            {/* A Shopify shop counts only once our server finds this code on it. */}
            {connectedAs === 'shopify' && status?.shopProof !== 'proven' ? (
              <form onSubmit={checkStore} className={classes.proofCheck}>
                <Text size="sm" fw={600}>{copy.shopCheckTitle}</Text>
                {status?.connectionReason === 'shop_proven_elsewhere' ? <Text size="sm">{copy.provenElsewhere}</Text> : null}
                <Text size="sm">
                  {copy.shopCheck(shopOutcome, shopRetryAfter)}
                </Text>
                {storefront?.addedDomain ? <Text size="sm">{copy.primaryDomainAdded(storefront.addedDomain)}</Text> : null}
                {passwordPage ? <Text size="sm" c="dimmed">{copy.passwordPageNote}</Text> : null}
                {passwordAsked ? (
                  <PasswordInput
                    label={copy.passwordLabel}
                    description={copy.passwordHint}
                    value={password}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    autoComplete="off"
                    dir="ltr"
                    maxLength={256}
                  />
                ) : null}
                <Group gap="xs" wrap="wrap">
                  {shopOutcome === 'awaiting_visit' ? (
                    /* The code is there: the one thing left is a product page visit. */
                    <Button component="a" href={visitUrl} target="_blank" rel="noopener noreferrer" radius="pill" size="xs"
                      rightSection={<GcIcon name="ext" size={14} />}>
                      {visitLabel}
                    </Button>
                  ) : null}
                  {shopOutcome === 'not_found' && shopifyDomain ? (
                    /* We read the published theme only: send them to it. */
                    <Button component="a" href={`https://${shopifyDomain}/admin/themes/current/editor`} target="_blank"
                      rel="noopener noreferrer" radius="pill" size="xs" variant="default" rightSection={<GcIcon name="ext" size={14} />}>
                      {copy.openLiveTheme}
                    </Button>
                  ) : null}
                  <Button type="submit" radius="pill" size="xs" variant={shopOutcome === 'awaiting_visit' ? 'default' : 'filled'}
                    className={classes.copy} loading={busy === 'check'} disabled={!snippet}>
                    {copy.checkStore}
                  </Button>
                </Group>
              </form>
            ) : null}
            {/* Installed is independent of preview or live; Try-On says which. */}
            {status && everSeen ? (
              <Stack gap={6}>
                <Group gap="xs" wrap="nowrap">
                  <GcIcon name="check" size={18} />
                  <Text size="sm">{copy.chatLive(status.seenHost ?? storeHost ?? '')}</Text>
                </Group>
                {lastSeenAt && now ? (
                  <Text size="xs" c="dimmed">{copy.domainState.live(ago(minutesSince(lastSeenAt, now) ?? 0))}</Text>
                ) : null}
                <Group gap="xs" wrap="nowrap">
                  <GcIcon name={status.tryOnReady ? 'check' : 'info'} size={18} />
                  <Text size="sm">{status.tryOnReady ? copy.tryOnLive : copy.tryOnReason(status.tryOnReason)}</Text>
                </Group>
                {!status.tryOnReady ? (
                  <Button component={Link} href="/dashboard/try-on/setup" variant="subtle" size="compact-sm" className={classes.copy}>
                    {copy.goTryOnSetup}
                  </Button>
                ) : null}
              </Stack>
            ) : snippet ? (
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <span className={classes.pulse} aria-hidden="true" />
                <div>
                  <Text size="sm">{copy.waiting}</Text>
                  <Text size="xs" c="dimmed">{connectedAs === 'shopify' ? copy.waitingHintShopify : copy.waitingHint}</Text>
                </div>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">{copy.codeLocked}</Text>
            )}
            {/* Shopify's "found" state already shows this link as its main action. */}
            {snippet && storeHost && !(connectedAs === 'shopify' && status?.shopProof !== 'proven' && shopOutcome === 'awaiting_visit') ? (
              <Button component="a" href={visitUrl} target="_blank" rel="noopener noreferrer" variant="default" radius="pill" size="xs" mt="xs" className={classes.copy} rightSection={<GcIcon name="ext" size={14} />}>
                {visitLabel}
              </Button>
            ) : null}
          </li>
        </ol>
      ) : null}

      {platform && platform !== 'woocommerce' && !installed ? (
        <Group justify="space-between" gap="sm" className={classes.help}>
          <Text size="sm">{copy.doneForYou}</Text>
          <Button
            component="a"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(copy.doneForYouAction)}`}
            variant="default"
            radius="pill"
            size="xs"
            leftSection={<GcIcon name="mail" size={14} />}
          >
            {copy.doneForYouAction}
          </Button>
        </Group>
      ) : null}

      {connectedAs === 'shopify' && snippet ? (
        <div className={classes.reset}>
          <Text size="sm" fw={600}>{copy.resetTitle}</Text>
          <Text size="xs" c="dimmed">{resetUntil ? copy.resetDone(resetUntil) : copy.resetBody}</Text>
          {resetStep === 'idle' ? (
            <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setResetStep('confirm')}>
              {copy.resetAction}
            </Button>
          ) : (
            <Group gap="xs">
              <Button color="red" size="compact-sm" loading={busy === 'reset'} onClick={() => void reset()}>
                {copy.resetConfirm}
              </Button>
              <Button variant="subtle" color="gray" size="compact-sm" onClick={() => setResetStep('idle')}>
                {copy.cancel}
              </Button>
            </Group>
          )}
        </div>
      ) : null}
    </Stack>
  );
}

function CodeLine({ value, copy }: { value: string; copy: PasteInstallCopy }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Code dir="ltr" className={classes.codeLine}>{value}</Code>
      <CopyButton value={value} timeout={2000}>
        {({ copied, copy: doCopy }) => (
          <Button variant="subtle" size="compact-xs" onClick={doCopy}>
            {copied ? copy.copied : copy.copyCode}
          </Button>
        )}
      </CopyButton>
    </Group>
  );
}
