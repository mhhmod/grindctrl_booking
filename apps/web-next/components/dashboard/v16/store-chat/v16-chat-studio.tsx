'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ActionIcon, Button, ColorInput, Modal, SegmentedControl, Switch, TextInput, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { GcIcon } from '@/components/icons';
import { PreviewFrame } from '@/components/dashboard/messenger/preview-frame';
import { appEmbedActivationUrl } from '@/lib/shopify/app-identity';
import { buildCanonicalInstallSnippet } from '@/lib/adapters/install';
import { getChatStudioCopy, type ChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import {
  INSTRUCTIONS_MAX,
  hidePatch,
  hoursLine,
  previewPayload,
  reviewRows,
  withPattern,
  withRecipient,
  type StudioSection,
} from '@/lib/dashboard/chat-studio-model';
import type { DomainActions, MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { ActionResult } from '@/lib/messenger/actions-core';
import type { MessengerConfig } from '@/lib/messenger/types';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { StorefrontDomains } from './storefront-domains';
import classes from './v16-chat-studio.module.css';

/* The v16 Store Chat Set up tab (04-dashboard.md, the ChatStudio board) on
   today's draft and publish (01-system.md): every change is saved to the
   draft as it is made, the bar counts what is not live yet, and Publish
   puts it in front of shoppers. Every card maps to MessengerConfig. The
   board's new parts wait for their back ends: the Add to cart lift and the
   product page line (N13), Match my theme and the contrast check (N27),
   the assistant's own name, address form and Franco (N26), WhatsApp alerts
   by shift (N22), and the preview's states (N12). */

export type ChatStudioActions = Pick<
  MessengerHostActions,
  'saveDraftSections' | 'publishConfig' | 'revertConfigAction' | 'setMessengerEnabled' | 'disconnectSiteAction'
> & { discardDraft(siteId: string): Promise<ActionResult> } & Partial<DomainActions>;

export type ChatStudioMeta = {
  domain: string | null;
  embedKey: string;
  active: boolean;
  version: number;
  canRevert: boolean;
  canDisconnect: boolean;
  ordersAuthorized: boolean;
  /** Minutes since the widget was last seen on the storefront, or null. */
  lastSeenMinutes: number | null;
  /** n25_handoff_rules: the extra handoff rules. */
  handoffRules: boolean;
};

type Pair = { label: string; body: string };

function Section({ id, copy, children }: { id: string; copy: Pair; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={classes.card}>
      <div className={classes.head}>
        <h2 id={id} className={classes.h2}>
          {copy.label}
        </h2>
        <p className={classes.muted}>{copy.body}</p>
      </div>
      {children}
    </section>
  );
}

function SwitchRow({
  id,
  label,
  body,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string;
  label: string;
  body?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={classes.row}>
      <div className={classes.rowText}>
        <label htmlFor={id} className={classes.h3}>
          {label}
        </label>
        {body && (
          <p id={`${id}-body`} className={classes.muted}>
            {body}
          </p>
        )}
        {children}
      </div>
      <Switch
        id={id}
        size="md"
        checked={checked}
        disabled={disabled}
        aria-describedby={body ? `${id}-body` : undefined}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  body,
  value,
  options,
  onChange,
}: {
  label: string;
  body?: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  // Four choices do not fit across a phone, nor three across the narrowest; they stack there.
  const count = Object.keys(options).length;
  const phone = useMediaQuery('(max-width: 25em)') ?? false;
  const smallPhone = useMediaQuery('(max-width: 22.5em)') ?? false;
  const narrow = (phone && count > 3) || (smallPhone && count > 2);
  return (
    <div className={classes.row}>
      <div className={classes.rowText}>
        <h3 className={classes.h3}>{label}</h3>
        {body && <p className={classes.muted}>{body}</p>}
      </div>
      <SegmentedControl
        aria-label={label}
        className={classes.choice}
        orientation={narrow ? 'vertical' : 'horizontal'}
        fullWidth={narrow}
        value={value}
        onChange={(next) => onChange(next as T)}
        data={(Object.keys(options) as T[]).map((key) => ({ value: key, label: options[key] }))}
      />
    </div>
  );
}

/** One text in English and Arabic, as every bilingual row on the board has it. */
function Bilingual({
  copy,
  label,
  body,
  value,
  multiline,
  onChange,
}: {
  copy: ChatStudioCopy;
  label: string;
  body?: string;
  value: { en: string; ar: string };
  multiline?: boolean;
  onChange: (value: { en: string; ar: string }) => void;
}) {
  const field = (language: 'en' | 'ar') => {
    const props = {
      label: language === 'en' ? copy.english : copy.arabic,
      'aria-label': language === 'en' ? copy.inEnglish(label) : copy.inArabic(label),
      dir: language === 'en' ? 'ltr' : 'rtl',
      lang: language,
      value: value[language],
    } as const;
    return multiline ? (
      <Textarea {...props} rows={3} resize="vertical" onChange={(event) => onChange({ ...value, [language]: event.currentTarget.value })} />
    ) : (
      <TextInput {...props} onChange={(event) => onChange({ ...value, [language]: event.currentTarget.value })} />
    );
  };
  return (
    <fieldset className={`${classes.block} ${classes.fieldset}`}>
      <legend className={classes.legend}>{label}</legend>
      {body && <p className={classes.muted}>{body}</p>}
      <div className={classes.pair}>
        {field('en')}
        {field('ar')}
      </div>
    </fieldset>
  );
}

/** A colour typed by hand reaches the draft only once it is a whole hex
    colour; the half-typed text stays in the field until then. */
function HexColour({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = React.useState(value);
  const [shown, setShown] = React.useState(value);
  if (value !== shown) {
    // The draft changed elsewhere (a pick, or Discard): show it.
    setShown(value);
    setText(value);
  }
  return (
    <ColorInput
      aria-label={label}
      className={classes.colour}
      value={text}
      format="hex"
      withEyeDropper={false}
      dir="ltr"
      onChange={(next) => {
        setText(next);
        if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange(next);
      }}
    />
  );
}

/** Removable entries with a field to add one, for pages and alert addresses. */
function Chips({
  copy,
  label,
  items,
  placeholder,
  error,
  onAdd,
  onRemove,
  type = 'text',
}: {
  copy: ChatStudioCopy;
  label: string;
  items: string[];
  placeholder: string;
  error: string | null;
  onAdd: (value: string) => boolean;
  onRemove: (value: string) => void;
  type?: 'text' | 'email';
}) {
  const [value, setValue] = React.useState('');
  // A removed entry takes its button with it; focus goes back to the field.
  const inputRef = React.useRef<HTMLInputElement>(null);
  const add = () => {
    if (onAdd(value)) setValue('');
  };
  return (
    <div className={classes.chips}>
      {items.length > 0 && (
        <ul className={classes.chipList} aria-label={label}>
          {items.map((item) => (
            <li key={item} className={classes.chip}>
              <bdi dir="ltr">{item}</bdi>
              <ActionIcon
                variant="subtle"
                size={28}
                radius="xl"
                aria-label={copy.remove(item)}
                onClick={() => {
                  onRemove(item);
                  inputRef.current?.focus();
                }}
              >
                <GcIcon name="x" size={14} />
              </ActionIcon>
            </li>
          ))}
        </ul>
      )}
      <div className={classes.addRow}>
        <TextInput
          ref={inputRef}
          aria-label={label}
          className={classes.addInput}
          type={type}
          dir="ltr"
          value={value}
          placeholder={placeholder}
          error={error ?? undefined}
          onChange={(event) => setValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button variant="default" radius="pill" onClick={add}>
          {copy.add}
        </Button>
      </div>
    </div>
  );
}

export function V16ChatStudio({
  locale,
  siteId,
  published,
  config,
  payload,
  meta,
  actions,
}: {
  locale: SiteLocale;
  siteId: string;
  /** The published version, resolved. */
  published: MessengerConfig;
  /** The draft over the published version, resolved; the published one when there is no draft. */
  config: MessengerConfig;
  payload: PublicMessengerPayload;
  meta: ChatStudioMeta;
  actions: ChatStudioActions;
}) {
  const copy = getChatStudioCopy(locale);
  const id = React.useId();
  const [base, setBase] = React.useState(published);
  const [draft, setDraft] = React.useState(config);
  const [version, setVersion] = React.useState(meta.version);
  const [active, setActive] = React.useState(meta.active);
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [busy, setBusy] = React.useState<'publish' | 'discard' | 'revert' | 'disconnect' | 'active' | null>(null);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState<'revert' | 'disconnect' | null>(null);
  const [patternError, setPatternError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const router = useRouter();
  /* Publish and Discard leave with the changes; focus goes to what is
     left, not to the page's start. */
  const studioRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);

  /* The draft is saved as it is made: edits mark their section, and one
     write per pause carries every marked section (they share one draft
     row, so parallel writes would lose all but the last). Writes run one
     after another, so an older one never lands last. */
  const draftRef = React.useRef(draft);
  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const dirty = React.useRef(new Set<StudioSection>());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = React.useRef<Promise<boolean>>(Promise.resolve(true));

  const flush = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    chain.current = chain.current.then(async () => {
      const sections = [...dirty.current];
      if (sections.length === 0) return true;
      dirty.current.clear();
      setSaveState('saving');
      const result = await actions
        .saveDraftSections(
          siteId,
          sections.map((section) => ({ section, payload: draftRef.current[section] as object })),
        )
        .catch((): ActionResult => ({ ok: false, error: 'failed' }));
      if (!result.ok) {
        sections.forEach((section) => dirty.current.add(section));
        setSaveState('error');
        return false;
      }
      setSaveState('idle');
      return true;
    });
    return chain.current;
  }, [actions, siteId]);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const update = <S extends StudioSection>(section: S, patch: Partial<MessengerConfig[S]>) => {
    setDraft((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
    dirty.current.add(section);
    setNote(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  const rows = reviewRows(base, draft, copy, locale);
  const pending = rows.length > 0;

  const publish = async () => {
    setBusy('publish');
    setNote(null);
    const saved = await flush();
    const result = saved ? await actions.publishConfig(siteId).catch((): ActionResult => ({ ok: false, error: 'failed' })) : null;
    setBusy(null);
    if (!result?.ok) {
      setNote({ ok: false, text: copy.failed });
      return;
    }
    setBase(draftRef.current);
    setVersion((current) => current + 1);
    setNote({ ok: true, text: copy.published });
    requestAnimationFrame(() => barRef.current?.focus());
  };

  const discard = async () => {
    setBusy('discard');
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current.clear();
    await chain.current;
    const result = await actions.discardDraft(siteId).catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(null);
    if (!result.ok) {
      setNote({ ok: false, text: copy.failed });
      return;
    }
    setDraft(base);
    setSaveState('idle');
    setNote(null);
    requestAnimationFrame(() => studioRef.current?.focus());
  };

  const setLive = async (next: boolean) => {
    setBusy('active');
    setActive(next);
    const result = await actions.setMessengerEnabled(siteId, next).catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(null);
    if (!result.ok) {
      setActive(!next);
      setNote({ ok: false, text: copy.failed });
    }
  };

  const runConfirmed = async () => {
    const what = confirm;
    setConfirm(null);
    if (what === 'revert') {
      setBusy('revert');
      const result = await actions.revertConfigAction(siteId).catch((): ActionResult => ({ ok: false, error: 'failed' }));
      setBusy(null);
      // The previous version comes back from the server.
      if (result.ok) window.location.reload();
      else setNote({ ok: false, text: copy.failed });
    }
    if (what === 'disconnect' && actions.disconnectSiteAction) {
      setBusy('disconnect');
      const result = await actions.disconnectSiteAction(siteId).catch((): ActionResult => ({ ok: false, error: 'failed' }));
      setBusy(null);
      if (result.ok) {
        router.replace('/dashboard/store-chat');
        router.refresh();
      } else setNote({ ok: false, text: copy.failed });
    }
  };

  const a = draft.appearance;
  const b = draft.behaviour;
  const ai = draft.ai;
  const shopify = Boolean(meta.domain && meta.domain.endsWith('.myshopify.com'));
  const seen = meta.lastSeenMinutes;
  const rules = ai.handoffRules;
  const bigOrderAmount = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: rules.bigOrder.currency || 'EGP',
    maximumFractionDigits: 0,
  }).format(rules.bigOrder.amountMinor / 100);

  return (
    <div ref={studioRef} tabIndex={-1} className={classes.studio}>
      <div className={classes.liveRow}>
        <Switch
          size="md"
          labelPosition="left"
          label={active ? copy.storeChatOn : copy.storeChatOff}
          checked={active}
          disabled={busy === 'active'}
          onChange={(event) => void setLive(event.currentTarget.checked)}
        />
      </div>

      {(pending || note) && (
        <div ref={barRef} tabIndex={-1} role="region" aria-label={copy.changesLabel} className={classes.bar} data-state={pending ? 'pending' : note?.ok ? 'done' : 'error'}>
          <span className={classes.barMessage}>
            <span role="status" className={classes.barText}>
              {busy === 'publish' ? copy.publishing : pending ? copy.notLive(rows.length) : note?.ok ? note.text : ''}
            </span>
            {pending && (
              <span className={classes.barSub}>
                {saveState === 'saving' ? copy.saving : saveState === 'error' ? copy.saveFailed : copy.changesSaved}
              </span>
            )}
            {note && !note.ok && (
              <span role="alert" className={classes.barSub}>
                {note.text}
              </span>
            )}
          </span>
          {pending && (
            <span className={classes.barActions}>
              <Button variant="subtle" radius="pill" className={classes.barLink} onClick={() => setReviewOpen(true)}>
                {copy.reviewChanges}
              </Button>
              <Button variant="default" radius="pill" onClick={() => void discard()} loading={busy === 'discard'} disabled={busy === 'publish'}>
                {copy.discard}
              </Button>
              <Button radius="pill" className={classes.publishButton} onClick={() => void publish()} loading={busy === 'publish'} disabled={busy === 'discard'}>
                {copy.publish}
              </Button>
            </span>
          )}
        </div>
      )}

      <Modal
        opened={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title={copy.reviewChanges}
        size="lg"
        closeButtonProps={{ 'aria-label': copy.close }}
      >
        <table className={classes.review}>
          <thead>
            <tr>
              <th scope="col">
                <span className={classes.srOnly}>{copy.changesLabel}</span>
              </th>
              <th scope="col">{copy.before}</th>
              <th scope="col">{copy.after}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>
                  <bdi>{row.before}</bdi>
                </td>
                <td>
                  <bdi>{row.after}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>

      <Modal
        opened={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'disconnect' ? copy.disconnect.label : copy.revert}
        closeButtonProps={{ 'aria-label': copy.close }}
      >
        <p className={classes.confirmText}>{confirm === 'disconnect' ? copy.disconnectConfirm : copy.revertConfirm}</p>
        <div className={classes.confirmActions}>
          <Button variant="default" radius="pill" onClick={() => setConfirm(null)}>
            {copy.cancel}
          </Button>
          <Button radius="pill" color={confirm === 'disconnect' ? 'danger' : undefined} onClick={() => void runConfirmed()}>
            {confirm === 'disconnect' ? copy.disconnect.label : copy.revert}
          </Button>
        </div>
      </Modal>

      <div className={classes.layout}>
        <div className={classes.form}>
          <Section id={`${id}-where`} copy={copy.whereItAppears}>
            <ChoiceRow
              label={copy.chatBubble.label}
              body={copy.chatBubble.body}
              value={a.position}
              options={copy.sides}
              onChange={(position) => update('appearance', { position })}
            />
            <div className={classes.block}>
              <h3 className={classes.h3}>{copy.hidePages.label}</h3>
              <p className={classes.muted}>{copy.hidePages.body}</p>
              <Chips
                copy={copy}
                label={copy.hidePages.label}
                items={b.excludePatterns}
                placeholder={copy.hidePlaceholder}
                error={patternError}
                onAdd={(value) => {
                  const next = withPattern(b.excludePatterns, value);
                  setPatternError(null);
                  if (!next) return !value.trim();
                  update('behaviour', hidePatch(next));
                  return true;
                }}
                onRemove={(value) => update('behaviour', hidePatch(b.excludePatterns.filter((item) => item !== value)))}
              />
            </div>
            <SwitchRow
              id={`${id}-hello`}
              label={copy.firstHello}
              body={copy.firstHelloBody(b.greetingDelaySeconds)}
              checked={b.greetingEnabled}
              onChange={(greetingEnabled) => update('behaviour', { greetingEnabled })}
            />
          </Section>

          <Section id={`${id}-look`} copy={copy.look}>
            <ChoiceRow label={copy.launcherIcon} value={a.launcherIcon} options={copy.icons} onChange={(launcherIcon) => update('appearance', { launcherIcon })} />
            <div className={classes.row}>
              <div className={classes.rowText}>
                <h3 className={classes.h3}>{copy.brandColour.label}</h3>
                <p className={classes.muted}>{copy.brandColour.body}</p>
              </div>
              <HexColour label={copy.brandColour.label} value={a.accentColor} onChange={(accentColor) => update('appearance', { accentColor })} />
            </div>
            <ChoiceRow label={copy.corners} value={a.radiusStyle} options={copy.radii} onChange={(radiusStyle) => update('appearance', { radiusStyle })} />
            <ChoiceRow label={copy.theme} value={a.themeMode} options={copy.themes} onChange={(themeMode) => update('appearance', { themeMode })} />
            <Bilingual
              copy={copy}
              label={copy.launcherLabel.label}
              body={copy.launcherLabel.body}
              value={a.launcherLabel}
              onChange={(launcherLabel) => update('appearance', { launcherLabel })}
            />
          </Section>

          <Section id={`${id}-welcome`} copy={copy.welcome}>
            <Bilingual copy={copy} label={copy.welcomeTitle} value={b.welcomeTitle} onChange={(welcomeTitle) => update('behaviour', { welcomeTitle })} />
            <Bilingual
              copy={copy}
              label={copy.welcomeMessage}
              value={b.welcomeSubtitle}
              multiline
              onChange={(welcomeSubtitle) => update('behaviour', { welcomeSubtitle })}
            />
            <Bilingual
              copy={copy}
              label={copy.inputHint.label}
              body={copy.inputHint.body}
              value={b.inputPlaceholder}
              onChange={(inputPlaceholder) => update('behaviour', { inputPlaceholder })}
            />
          </Section>

          <Section id={`${id}-assistant`} copy={copy.assistant}>
            <SwitchRow
              id={`${id}-ai`}
              label={copy.assistantReplies.label}
              body={copy.assistantReplies.body}
              checked={ai.enabled}
              onChange={(enabled) => update('ai', { enabled })}
            />
            <ChoiceRow label={copy.tone} value={ai.tone} options={copy.tones} onChange={(tone) => update('ai', { tone })} />
            <ChoiceRow label={copy.replyLanguage} value={ai.languageMode} options={copy.replyLanguages} onChange={(languageMode) => update('ai', { languageMode })} />
            <ChoiceRow label={copy.dialect} value={ai.arabicDialect} options={copy.dialects} onChange={(arabicDialect) => update('ai', { arabicDialect })} />
            <div className={classes.block}>
              <Textarea
                label={copy.instructions.label}
                description={copy.instructions.body}
                inputWrapperOrder={['label', 'description', 'input']}
                value={ai.instructions}
                maxLength={INSTRUCTIONS_MAX}
                rows={4}
                resize="vertical"
                onChange={(event) => update('ai', { instructions: event.currentTarget.value })}
              />
              <p className={classes.count}>{copy.count(ai.instructions.length, INSTRUCTIONS_MAX)}</p>
            </div>
          </Section>

          <Section id={`${id}-person`} copy={copy.person}>
            <SwitchRow
              id={`${id}-offer`}
              label={copy.offerPerson.label}
              body={copy.offerPerson.body}
              checked={ai.escalationEnabled}
              onChange={(escalationEnabled) => update('ai', { escalationEnabled })}
            />
            {meta.handoffRules && (
              <>
                <SwitchRow
                  id={`${id}-orders-rule`}
                  label={copy.ruleOrderChanges.label}
                  body={copy.ruleOrderChanges.body}
                  checked={rules.orderChanges}
                  disabled={!ai.escalationEnabled}
                  onChange={(orderChanges) => update('ai', { handoffRules: { ...rules, orderChanges } })}
                />
                <SwitchRow
                  id={`${id}-upset`}
                  label={copy.ruleUpset}
                  checked={rules.upset}
                  disabled={!ai.escalationEnabled}
                  onChange={(upset) => update('ai', { handoffRules: { ...rules, upset } })}
                />
                <SwitchRow
                  id={`${id}-big`}
                  label={copy.ruleBigOrder}
                  body={copy.ruleBigOrderBody(bigOrderAmount, rules.bigOrder.piecesOfOne)}
                  checked={rules.bigOrder.enabled}
                  disabled={!ai.escalationEnabled}
                  onChange={(enabled) => update('ai', { handoffRules: { ...rules, bigOrder: { ...rules.bigOrder, enabled } } })}
                />
              </>
            )}
            <SwitchRow
              id={`${id}-ask`}
              label={copy.askWhere.label}
              body={copy.askWhere.body}
              checked={draft.contactCapture.enabled}
              onChange={(enabled) => update('contactCapture', { enabled })}
            />
            <SwitchRow
              id={`${id}-ask-hours`}
              label={copy.askOutsideHours}
              checked={draft.contactCapture.askOutsideHours}
              disabled={!draft.contactCapture.enabled}
              onChange={(askOutsideHours) => update('contactCapture', { askOutsideHours })}
            />
          </Section>

          <Section id={`${id}-photos`} copy={copy.photosOrders}>
            <SwitchRow
              id={`${id}-photo`}
              label={copy.photos.label}
              body={copy.photos.body}
              checked={draft.attachments.enabled}
              onChange={(enabled) => update('attachments', { enabled })}
            />
            <SwitchRow
              id={`${id}-triage`}
              label={copy.describePhotos.label}
              body={copy.describePhotos.body}
              checked={draft.attachments.triageEnabled}
              disabled={!draft.attachments.enabled}
              onChange={(triageEnabled) => update('attachments', { triageEnabled })}
            />
            {shopify && (
              <SwitchRow
                id={`${id}-orders`}
                label={copy.orderLookup.label}
                body={copy.orderLookup.body}
                checked={draft.orderLookup.enabled}
                onChange={(enabled) => update('orderLookup', { enabled })}
              >
                <p className={meta.ordersAuthorized ? classes.ok : classes.muted}>
                  {meta.ordersAuthorized && <GcIcon name="check" size={14} />}
                  {meta.ordersAuthorized ? copy.orderAccess : copy.noOrderAccess}
                </p>
              </SwitchRow>
            )}
          </Section>

          <Section id={`${id}-alerts`} copy={copy.alerted}>
            <SwitchRow
              id={`${id}-email`}
              label={copy.emailAlerts.label}
              body={copy.emailAlerts.body}
              checked={draft.notifications.emailOnHandoff}
              onChange={(emailOnHandoff) => update('notifications', { emailOnHandoff })}
            />
            <div className={classes.block}>
              <Chips
                copy={copy}
                label={copy.alertEmails}
                type="email"
                items={draft.notifications.recipients}
                placeholder={copy.addEmail}
                error={emailError}
                onAdd={(value) => {
                  if (!value.trim()) return false;
                  const result = withRecipient(draft.notifications.recipients, value);
                  if (!result.ok) {
                    setEmailError(result.reason === 'full' ? copy.tooManyEmails : copy.badEmail);
                    return false;
                  }
                  setEmailError(null);
                  update('notifications', { recipients: result.recipients });
                  return true;
                }}
                onRemove={(value) =>
                  update('notifications', { recipients: draft.notifications.recipients.filter((item) => item !== value) })
                }
              />
            </div>
          </Section>

          <section aria-labelledby={`${id}-hours`} className={classes.card}>
            <h2 id={`${id}-hours`} className={classes.h2}>
              {copy.hours}
            </h2>
            <div className={classes.row}>
              <div className={classes.rowText}>
                <h3 className={classes.h3}>{copy.businessHours}</h3>
                <p className={classes.muted}>{hoursLine(b, locale)}</p>
                {b.availabilityMode === 'hours' && <p className={classes.muted}>{copy.hoursAfter}</p>}
              </div>
              <Button component={Link} href="/dashboard/store-chat/setup?tab=behaviour" variant="default" radius="pill">
                {copy.change}
              </Button>
            </div>
          </section>

          <section aria-labelledby={`${id}-install`} className={classes.card}>
            <h2 id={`${id}-install`} className={classes.h2}>
              {copy.installation}
            </h2>
            <div className={classes.block}>
              <p className={classes.muted}>{seen === null ? copy.neverChecked : copy.lastCheck(copy.ago(seen))}</p>
              <div className={classes.buttons}>
                {shopify && meta.domain && (
                  <Button
                    component="a"
                    href={appEmbedActivationUrl(meta.domain, 'messenger')}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="default"
                    radius="pill"
                    rightSection={<GcIcon name="ext" size={14} />}
                  >
                    {copy.openThemeEditor}
                  </Button>
                )}
                {meta.domain && (
                  <Button component="a" href={`https://${meta.domain}`} target="_blank" rel="noopener noreferrer" variant="default" radius="pill">
                    {copy.testNow}
                  </Button>
                )}
              </div>
              <p className={classes.muted}>
                {copy.notShopify}{' '}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  className={classes.inlineButton}
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(buildCanonicalInstallSnippet(meta.embedKey))
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => {});
                  }}
                >
                  {copied ? copy.copied : copy.copyScript}
                </Button>
              </p>
            </div>
            {!shopify &&
              actions.listDomainsAction &&
              actions.addDomainAction &&
              actions.checkDomainAction &&
              actions.removeDomainAction && (
                <StorefrontDomains
                  siteId={siteId}
                  copy={copy.domains}
                  actions={{
                    listDomainsAction: actions.listDomainsAction,
                    addDomainAction: actions.addDomainAction,
                    checkDomainAction: actions.checkDomainAction,
                    removeDomainAction: actions.removeDomainAction,
                  }}
                />
              )}
            <div className={classes.row}>
              <h3 className={classes.h3}>{copy.publishedVersion(version)}</h3>
              {meta.canRevert && (
                <Button variant="default" radius="pill" loading={busy === 'revert'} onClick={() => setConfirm('revert')}>
                  {copy.revert}
                </Button>
              )}
            </div>
            {meta.canDisconnect && actions.disconnectSiteAction && (
              <div className={classes.row}>
                <div className={classes.rowText}>
                  <Button variant="subtle" color="danger" className={classes.inlineButton} loading={busy === 'disconnect'} onClick={() => setConfirm('disconnect')}>
                    {copy.disconnect.label}
                  </Button>
                  <p className={classes.muted}>{copy.disconnect.body}</p>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby={`${id}-more`} className={classes.card}>
            <div className={classes.row}>
              <div className={classes.rowText}>
                <h2 id={`${id}-more`} className={classes.h3}>
                  {copy.moreSettings.label}
                </h2>
                <p className={classes.muted}>{copy.moreSettings.body}</p>
              </div>
              <Button component={Link} href="/dashboard/store-chat/setup?tab=appearance" variant="default" radius="pill">
                {copy.openMoreSettings}
              </Button>
            </div>
          </section>
        </div>

        <section aria-labelledby={`${id}-preview`} className={classes.preview}>
          <h2 id={`${id}-preview`} className={classes.h2}>
            {copy.preview}
          </h2>
          <PreviewFrame payload={previewPayload(payload, draft)} initialLocale={locale === 'ar' ? 'ar' : 'en'} />
          <p className={classes.muted}>{copy.previewCaption}</p>
        </section>
      </div>
    </div>
  );
}
