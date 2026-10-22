'use client';

import * as React from 'react';
import { Button, SegmentedControl, TextInput, Textarea } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { getChatKnowsCopy } from '@/lib/dashboard/chat-knows-copy';
import type { ChatHead, KnowledgeRow, PagesAndNotes } from '@/lib/dashboard/chat-knows-model';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16PageFrame } from '../page-frame';
import classes from './v16-chat-knows.module.css';

/* The v16 Store Chat page (04-dashboard.md): What it knows (the Knowledge
   board) and Set up, which is today's Store Chat page until ChatStudio
   lands. The model in lib/dashboard/chat-knows-model.ts decides what has a
   source; this file lays it out and calls today's knowledge actions. */

export type KnowledgeActions = Pick<
  MessengerHostActions,
  'addKnowledge' | 'updateKnowledgeStatus' | 'deleteKnowledge' | 'syncKnowledge'
>;

/** Rows shown before "Show all". */
const FIRST_ROWS = 5;

export function V16ChatFrame({
  locale,
  tab,
  head,
  children,
}: {
  locale: SiteLocale;
  tab: 'knows' | 'setup';
  head: ChatHead;
  children: React.ReactNode;
}) {
  const copy = getChatKnowsCopy(locale);
  return (
    <V16PageFrame
      badge={head.badge}
      subtitle={head.subtitle}
      action={
        head.storeUrl && (
          <Button
            component="a"
            href={head.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="default"
            radius="pill"
            rightSection={<GcIcon name="ext" size={15} />}
          >
            {copy.openStore}
          </Button>
        )
      }
      tabsLabel={copy.tabsLabel}
      tabs={[
        { label: copy.whatItKnows, href: '/dashboard/store-chat', current: tab === 'knows' },
        { label: copy.setUp, href: '/dashboard/store-chat/setup', current: tab === 'setup' },
      ]}
    >
      {children}
    </V16PageFrame>
  );
}

function AddForm({
  locale,
  siteId,
  actions,
  onDone,
  onCancel,
}: {
  locale: SiteLocale;
  siteId: string;
  actions: KnowledgeActions;
  onDone: (message: string, ok: boolean) => void;
  onCancel: () => void;
}) {
  const copy = getChatKnowsCopy(locale);
  const [kind, setKind] = React.useState<'note' | 'page'>('note');
  const [pending, startTransition] = React.useTransition();
  const ids = React.useId();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = new FormData();
    data.set('siteId', siteId);
    if (kind === 'page') {
      data.set('url', String(form.get('url') ?? '').trim());
    } else {
      data.set('title', String(form.get('title') ?? '').trim());
      data.set('content', String(form.get('content') ?? '').trim());
    }
    startTransition(async () => {
      const result = await actions.addKnowledge(data).catch(() => ({ ok: false as const, error: '' }));
      onDone(result.ok ? copy.added : kind === 'page' ? copy.linkFailed : copy.addFailed, result.ok);
    });
  }

  return (
    <form className={classes.form} onSubmit={submit} aria-label={copy.addPageOrNote}>
      <SegmentedControl
        aria-label={copy.kindLabel}
        value={kind}
        onChange={(value) => setKind(value as 'note' | 'page')}
        data={[
          { value: 'note', label: copy.note },
          { value: 'page', label: copy.page },
        ]}
        radius="xl"
        className={classes.kind}
      />
      {kind === 'note' ? (
        <>
          <TextInput id={`${ids}-title`} name="title" label={copy.title} placeholder={copy.titleHint} required maxLength={200} />
          <Textarea
            id={`${ids}-content`}
            name="content"
            label={copy.content}
            description={copy.contentHint}
            required
            rows={5}
            resize="vertical"
          />
        </>
      ) : (
        <TextInput
          id={`${ids}-url`}
          name="url"
          type="url"
          inputMode="url"
          dir="ltr"
          label={copy.link}
          description={copy.linkHint}
          placeholder="https://"
          required
        />
      )}
      <div className={classes.formActions}>
        <Button type="submit" radius="pill" loading={pending}>
          {pending ? copy.adding : copy.add}
        </Button>
        <Button type="button" variant="default" radius="pill" onClick={onCancel} disabled={pending}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}

function EntryRow({
  row,
  locale,
  siteId,
  actions,
  onResult,
}: {
  row: KnowledgeRow;
  locale: SiteLocale;
  siteId: string;
  actions: KnowledgeActions;
  onResult: (message: string | null, ok: boolean) => void;
}) {
  const copy = getChatKnowsCopy(locale);
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);

  function run(call: () => Promise<{ ok: boolean }>, success: string | null) {
    startTransition(async () => {
      const result = await call().catch(() => ({ ok: false }));
      onResult(result.ok ? success : copy.actionFailed, result.ok);
      if (result.ok) setConfirming(false);
    });
  }

  return (
    <li className={classes.row} aria-busy={pending || undefined}>
      <span className={classes.rowIcon} aria-hidden="true">
        <GcIcon name={row.kind === 'page' ? 'link' : 'doc'} size={16} />
      </span>
      <div className={classes.rowText}>
        <p className={classes.rowTitle}>
          <bdi>{row.title}</bdi>
        </p>
        <p className={classes.muted}>
          {row.kind === 'page' ? copy.page : copy.note}
          {row.host && (
            <>
              {' · '}
              <bdi dir="ltr">{row.host}</bdi>
            </>
          )}
          {' · '}
          {row.freshness}
        </p>
      </div>
      <span className={classes.pill} data-active={row.active}>
        {row.active ? copy.active : copy.paused}
      </span>
      <div className={classes.rowActions}>
        {confirming ? (
          <>
            <span className={classes.confirm}>{copy.removeConfirm}</span>
            <Button size="compact-sm" color="red" radius="pill" loading={pending} onClick={() => run(() => actions.deleteKnowledge(siteId, row.id), null)}>
              {copy.removeYes}
            </Button>
            <Button size="compact-sm" variant="default" radius="pill" disabled={pending} onClick={() => setConfirming(false)}>
              {copy.keep}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="compact-sm"
              variant="default"
              radius="pill"
              disabled={pending}
              onClick={() => run(() => actions.updateKnowledgeStatus(siteId, row.id, row.active ? 'disabled' : 'active'), null)}
            >
              {row.active ? copy.pause : copy.resume}
            </Button>
            {row.canResync && (
              <Button
                size="compact-sm"
                variant="default"
                radius="pill"
                disabled={pending}
                leftSection={<GcIcon name="refresh" size={14} />}
                onClick={() => run(() => actions.syncKnowledge(siteId, row.id), copy.resynced)}
              >
                {copy.resync}
              </Button>
            )}
            <Button size="compact-sm" variant="subtle" color="gray" radius="pill" disabled={pending} onClick={() => setConfirming(true)}>
              {copy.remove}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function V16ChatKnows({
  locale,
  head,
  pages,
  siteId,
  actions,
}: {
  locale: SiteLocale;
  head: ChatHead;
  pages: PagesAndNotes;
  siteId: string;
  actions: KnowledgeActions;
}) {
  const copy = getChatKnowsCopy(locale);
  const [adding, setAdding] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [note, setNote] = React.useState<{ text: string; ok: boolean } | null>(null);
  const rows = showAll ? pages.rows : pages.rows.slice(0, FIRST_ROWS);

  const report = (text: string | null, ok: boolean) => setNote(text ? { text, ok } : null);

  return (
    <V16ChatFrame locale={locale} tab="knows" head={head}>
      <section aria-labelledby="chat-learns" className={`${classes.card} ${classes.section}`}>
        <div className={classes.sectionHead}>
          <h2 id="chat-learns" className={classes.h2}>
            {copy.learnsFrom}
          </h2>
          {!adding && (
            <Button
              variant="default"
              radius="pill"
              leftSection={<GcIcon name="plus" size={16} />}
              onClick={() => {
                setNote(null);
                setAdding(true);
              }}
            >
              {copy.addPageOrNote}
            </Button>
          )}
        </div>

        {adding && (
          <AddForm
            locale={locale}
            siteId={siteId}
            actions={actions}
            onCancel={() => setAdding(false)}
            onDone={(text, ok) => {
              report(text, ok);
              if (ok) setAdding(false);
            }}
          />
        )}
        <p role="status" className={classes.note} data-ok={note?.ok}>
          {note?.text}
        </p>

        <div className={classes.tile}>
          <div className={classes.tileHead}>
            <span className={classes.tileIcon} aria-hidden="true">
              <GcIcon name="doc" size={18} />
            </span>
            <h3 className={classes.h3}>{copy.pagesAndNotes}</h3>
          </div>
          <p className={classes.muted}>
            <bdi>{pages.summary}</bdi>
          </p>
          {rows.length > 0 && (
            <ul className={classes.rows}>
              {rows.map((row) => (
                <EntryRow key={row.id} row={row} locale={locale} siteId={siteId} actions={actions} onResult={report} />
              ))}
            </ul>
          )}
          {pages.rows.length > FIRST_ROWS && (
            <Button variant="subtle" radius="pill" className={classes.more} onClick={() => setShowAll((value) => !value)}>
              {showAll ? copy.hide : copy.showAll(pages.rows.length)}
            </Button>
          )}
        </div>
      </section>
    </V16ChatFrame>
  );
}

export function V16ChatKnowsError({ locale, head }: { locale: SiteLocale; head: ChatHead }) {
  const copy = getChatKnowsCopy(locale);
  return (
    <V16ChatFrame locale={locale} tab="knows" head={head}>
      <p className={`${classes.card} ${classes.error}`} role="status">
        {copy.couldNotLoad}
      </p>
    </V16ChatFrame>
  );
}
