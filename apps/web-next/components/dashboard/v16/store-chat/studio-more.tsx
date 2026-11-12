'use client';

import * as React from 'react';
import { Badge, Button, Chip, FileButton, NativeSelect, TextInput, Textarea } from '@mantine/core';
import type { ChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import { hoursLine } from '@/lib/dashboard/chat-studio-model';
import {
  CANNED_REPLY_CONTENT_MAX,
  CANNED_REPLY_TITLE_MAX,
  type CannedReply,
} from '@/lib/messenger/canned-replies-limits';
import { ICON_MAX_BYTES, ICON_MIMES, type IconMime, type LauncherIconResult } from '@/lib/messenger/launcher-icon-check';
import type { ActionResult } from '@/lib/messenger/actions-core';
import type { MessengerBehaviour } from '@/lib/messenger/types';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-chat-studio.module.css';

/* The Set up cards that replaced the old "More settings" screens: a custom
   launcher icon, opening hours and saved replies. Icon and hours edit the
   draft like every other card; saved replies are saved as they are made,
   as they always were. */

/** Upload a square PNG, SVG or WebP. The server checks the real bytes again. */
export function IconUpload({
  copy,
  siteId,
  value,
  upload,
  onChange,
}: {
  copy: ChatStudioCopy;
  siteId: string;
  value: string | null;
  upload: (data: FormData) => Promise<LauncherIconResult>;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reset = React.useRef<() => void>(null);

  const send = async (file: File | null) => {
    reset.current?.();
    if (!file) return;
    setError(null);
    if (file.size > ICON_MAX_BYTES) return setError(copy.customIcon.errors.too_big);
    if (!(ICON_MIMES as readonly string[]).includes(file.type as IconMime)) return setError(copy.customIcon.errors.bad_type);
    setBusy(true);
    const data = new FormData();
    data.set('siteId', siteId);
    data.set('icon', file);
    const result = await upload(data).catch((): LauncherIconResult => ({ ok: false, error: 'failed' }));
    setBusy(false);
    if (result.ok) onChange(result.url);
    else setError(copy.customIcon.errors[result.error as keyof typeof copy.customIcon.errors] ?? copy.customIcon.errors.failed);
  };

  return (
    <div className={classes.block}>
      <h3 className={classes.h3}>{copy.customIcon.label}</h3>
      <p className={classes.muted}>{copy.customIcon.body}</p>
      <div className={classes.iconRow}>
        {value && (
          <span className={classes.iconPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the merchant's own icon, drawn small */}
            <img src={value} alt={copy.customIcon.alt} />
          </span>
        )}
        <FileButton resetRef={reset} onChange={(file) => void send(file)} accept={ICON_MIMES.join(',')}>
          {(props) => (
            <Button {...props} variant={value ? 'default' : 'filled'} radius="pill" loading={busy} className={classes.touch}>
              {busy ? copy.customIcon.uploading : value ? copy.customIcon.replace : copy.customIcon.upload}
            </Button>
          )}
        </FileButton>
        {value && (
          <Button variant="subtle" color="danger" radius="pill" disabled={busy} className={classes.touch} onClick={() => { setError(null); onChange(null); }}>
            {copy.customIcon.remove}
          </Button>
        )}
      </div>
      {value && !error && <p className={classes.muted}>{copy.customIcon.inUse}</p>}
      {error && (
        <p role="alert" className={classes.iconError}>
          {error}
        </p>
      )}
    </div>
  );
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function minutesOf(value: string, fallback: number): number {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? Math.max(0, Math.min(1440, h * 60 + m)) : fallback;
}

function timeZones(current: string): Array<{ group: string; items: string[] }> {
  let zones: string[] = [];
  try {
    zones = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    // An older runtime: the saved zone alone is still shown.
  }
  if (!zones.includes(current)) zones = [current, ...zones];
  const groups = new Map<string, string[]>();
  for (const zone of zones) {
    const region = zone.includes('/') ? zone.slice(0, zone.indexOf('/')) : 'Other';
    groups.set(region, [...(groups.get(region) ?? []), zone]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/** When the team is around: always, or chosen days with their own hours. */
export function HoursEditor({
  copy,
  locale,
  behaviour,
  shopTimezone,
  onChange,
}: {
  copy: ChatStudioCopy;
  locale: SiteLocale;
  behaviour: MessengerBehaviour;
  /** The store's own time zone, where opening hours start instead of UTC. */
  shopTimezone: string | null;
  onChange: (patch: Partial<MessengerBehaviour>) => void;
}) {
  const hours = [...behaviour.availabilityHours].sort((a, b) => a.day - b.day);
  /* About 400 zones: built as elements once per zone, so a keystroke elsewhere in
     the draft does not make React walk them again. */
  const zoneOptions = React.useMemo(
    () =>
      timeZones(behaviour.availabilityTimezone).map(({ group, items }) => (
        <optgroup key={group} label={group}>
          {items.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, ' ')}
            </option>
          ))}
        </optgroup>
      )),
    [behaviour.availabilityTimezone],
  );
  const setMode = (mode: 'always' | 'hours') =>
    onChange({
      availabilityMode: mode,
      ...(mode === 'hours' && behaviour.availabilityTimezone === 'UTC' && shopTimezone ? { availabilityTimezone: shopTimezone } : {}),
    });
  const setDays = (days: string[]) => {
    const chosen = days.map(Number);
    onChange({
      availabilityHours: chosen
        .sort((a, b) => a - b)
        .map((day) => behaviour.availabilityHours.find((window) => window.day === day) ?? { day, startMinute: 9 * 60, endMinute: 17 * 60 }),
    });
  };
  const setWindow = (day: number, patch: { startMinute?: number; endMinute?: number }) =>
    onChange({ availabilityHours: behaviour.availabilityHours.map((window) => (window.day === day ? { ...window, ...patch } : window)) });

  return (
    <div className={classes.block}>
      <h3 className={classes.h3}>{copy.businessHours}</h3>
      <p className={classes.muted}>{hoursLine(behaviour, locale)}</p>
      <div className={classes.buttons} role="group" aria-label={copy.businessHours}>
        {(['always', 'hours'] as const).map((mode) => (
          <Button
            key={mode}
            variant={behaviour.availabilityMode === mode ? 'filled' : 'default'}
            radius="pill"
            aria-pressed={behaviour.availabilityMode === mode}
            className={classes.touch}
            onClick={() => setMode(mode)}
          >
            {copy.hoursModes[mode]}
          </Button>
        ))}
      </div>
      {behaviour.availabilityMode === 'hours' && (
        <>
          <p className={classes.muted}>{copy.hoursAfter}</p>
          <NativeSelect
            label={copy.timezone}
            className={classes.narrowInput}
            dir="ltr"
            value={behaviour.availabilityTimezone}
            onChange={(event) => onChange({ availabilityTimezone: event.currentTarget.value })}
          >
            {zoneOptions}
          </NativeSelect>
          <Chip.Group multiple value={hours.map((window) => String(window.day))} onChange={setDays}>
            <div className={classes.days} role="group" aria-label={copy.businessHours}>
              {copy.days.map((name, day) => (
                <Chip key={name} value={String(day)} variant="outline" radius="xl">
                  {name}
                </Chip>
              ))}
            </div>
          </Chip.Group>
          {hours.length === 0 && (
            <p role="status" className={classes.warn}>
              {copy.noDays}
            </p>
          )}
          {hours.length > 0 && (
            <ul className={classes.windows}>
              {hours.map((window) => (
                <li key={window.day} className={classes.window}>
                  <span className={classes.windowDay}>{copy.days[window.day]}</span>
                  <TextInput
                    type="time"
                    dir="ltr"
                    label={copy.from}
                    aria-label={`${copy.from}, ${copy.days[window.day]}`}
                    value={hhmm(window.startMinute)}
                    onChange={(event) => setWindow(window.day, { startMinute: minutesOf(event.currentTarget.value, window.startMinute) })}
                  />
                  <TextInput
                    type="time"
                    dir="ltr"
                    label={copy.to}
                    aria-label={`${copy.to}, ${copy.days[window.day]}`}
                    value={hhmm(window.endMinute)}
                    onChange={(event) => setWindow(window.day, { endMinute: minutesOf(event.currentTarget.value, window.endMinute) })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export type SavedReplyActions = {
  addCannedReply(siteId: string, title: string, content: string): Promise<ActionResult>;
  updateCannedReplyStatus(siteId: string, replyId: string, status: 'active' | 'disabled'): Promise<ActionResult>;
  deleteCannedReply(siteId: string, replyId: string): Promise<ActionResult>;
};

/** Short answers the team sends from the inbox. Saved as they are made, not with the draft. */
export function SavedReplies({
  copy,
  siteId,
  replies,
  actions,
}: {
  copy: ChatStudioCopy;
  siteId: string;
  replies: CannedReply[];
  actions: SavedReplyActions;
}) {
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const run = async (id: string, call: () => Promise<ActionResult>, success: string | null, after?: () => void) => {
    setBusy(id);
    const result = await call().catch((): ActionResult => ({ ok: false, error: 'failed' }));
    setBusy(null);
    setNote(result.ok ? (success ? { ok: true, text: success } : null) : { ok: false, text: copy.replyFailed });
    if (result.ok) after?.();
  };

  const ready = title.trim() !== '' && content.trim() !== '';
  return (
    <>
      <form
        className={`${classes.block} ${classes.replyForm}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && busy === null) void run('new', () => actions.addCannedReply(siteId, title.trim(), content.trim()), copy.replyAdded, () => { setTitle(''); setContent(''); });
        }}
      >
        <TextInput label={copy.replyTitle} value={title} maxLength={CANNED_REPLY_TITLE_MAX} autoComplete="off" onChange={(event) => setTitle(event.currentTarget.value)} />
        <Textarea label={copy.replyText} value={content} maxLength={CANNED_REPLY_CONTENT_MAX} rows={3} resize="vertical" onChange={(event) => setContent(event.currentTarget.value)} />
        <div className={classes.buttons}>
          <Button type="submit" radius="pill" disabled={!ready} loading={busy === 'new'}>
            {copy.addReply}
          </Button>
        </div>
        <p aria-live="polite" className={classes.note} data-ok={note?.ok}>
          {note?.text}
        </p>
      </form>
      {replies.length === 0 ? (
        <p className={`${classes.block} ${classes.muted}`}>{copy.noReplies}</p>
      ) : (
        <ul className={`${classes.block} ${classes.replyList}`}>
          {replies.map((reply) => (
            <li key={reply.id} className={classes.reply} aria-busy={busy === reply.id || undefined}>
              <div className={classes.replyHead}>
                <p className={classes.replyTitle}>
                  <bdi>{reply.title}</bdi>
                </p>
                <Badge variant={reply.status === 'active' ? 'light' : 'default'} radius="pill">
                  {reply.status === 'active' ? copy.replyActive : copy.replyOff}
                </Badge>
              </div>
              <p className={classes.replyBody}>
                <bdi>{reply.content}</bdi>
              </p>
              <div className={classes.buttons}>
                <Button
                  variant="default"
                  radius="pill"
                  disabled={busy !== null}
                  className={classes.touch}
                  onClick={() => void run(reply.id, () => actions.updateCannedReplyStatus(siteId, reply.id, reply.status === 'active' ? 'disabled' : 'active'), null)}
                >
                  {reply.status === 'active' ? copy.replyTurnOff : copy.replyTurnOn}
                </Button>
                <Button
                  variant="subtle"
                  color="danger"
                  radius="pill"
                  disabled={busy !== null}
                  className={classes.touch}
                  onClick={() => void run(reply.id, () => actions.deleteCannedReply(siteId, reply.id), null)}
                >
                  {copy.replyDelete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
