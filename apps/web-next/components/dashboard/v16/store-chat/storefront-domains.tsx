'use client';

import * as React from 'react';
import { Button, CopyButton, TextInput } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import type { ChatStudioCopy } from '@/lib/dashboard/chat-studio-copy';
import type { DomainActions } from '@/lib/messenger/dashboard-actions-contract';
import type { DomainView } from '@/lib/messenger/domains';
import classes from './v16-chat-studio.module.css';

/* The domains a store that is not on Shopify proves by DNS, so Store Chat
   answers there (lib/messenger/domains.ts). A Shopify store never sees
   this: Shopify tells us its domains. One obvious next step per state:
   add a domain, publish the record, check it. */

type Copy = ChatStudioCopy['domains'];

function errorText(copy: Copy, error: string): string {
  return (copy.errors as Record<string, string>)[error] ?? copy.errors.generic;
}

function RecordField({ label, value, copy }: { label: string; value: string; copy: Copy }) {
  return (
    <div className={classes.recordField}>
      <span className={classes.muted}>{label}</span>
      <code dir="ltr" className={classes.recordValue}>
        {value}
      </code>
      <CopyButton value={value}>
        {({ copied, copy: doCopy }) => (
          <Button variant="subtle" size="compact-sm" className={classes.inlineButton} onClick={doCopy} aria-label={`${copy.copy}: ${label}`}>
            {copied ? copy.copied : copy.copy}
          </Button>
        )}
      </CopyButton>
    </div>
  );
}

export function StorefrontDomains({ siteId, copy, actions }: { siteId: string; copy: Copy; actions: DomainActions }) {
  const [domains, setDomains] = React.useState<DomainView[] | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<{ id: string; text: string } | null>(null);
  const inputId = React.useId();

  React.useEffect(() => {
    let live = true;
    actions
      .listDomainsAction(siteId)
      .then((result) => {
        if (!live) return;
        if (result.ok) setDomains(result.domains ?? []);
        else setLoadFailed(true);
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [actions, siteId]);

  const replace = (next: DomainView) =>
    setDomains((current) => {
      const list = current ?? [];
      return list.some((row) => row.id === next.id) ? list.map((row) => (row.id === next.id ? next : row)) : [...list, next];
    });

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) {
      setInputError(copy.errors.invalid_domain);
      return;
    }
    setBusy('add');
    setInputError(null);
    const result = await actions.addDomainAction(siteId, input).catch(() => ({ ok: false as const, error: 'generic' }));
    setBusy(null);
    if (!result.ok) {
      setInputError(errorText(copy, result.error));
      return;
    }
    if (result.domain) replace(result.domain);
    setInput('');
  }

  async function check(row: DomainView) {
    setBusy(`check:${row.id}`);
    setRowError(null);
    const result = await actions.checkDomainAction(siteId, row.id).catch(() => ({ ok: false as const, error: 'generic' }));
    setBusy(null);
    if (!result.ok) {
      setRowError({ id: row.id, text: errorText(copy, result.error) });
      return;
    }
    if (result.domain) replace(result.domain);
  }

  async function remove(row: DomainView) {
    setBusy(`remove:${row.id}`);
    setRowError(null);
    const result = await actions.removeDomainAction(siteId, row.id).catch(() => ({ ok: false as const, error: 'generic' }));
    setBusy(null);
    if (!result.ok) {
      setRowError({ id: row.id, text: errorText(copy, result.error) });
      return;
    }
    setDomains((current) => (current ?? []).filter((item) => item.id !== row.id));
  }

  const full = (domains?.length ?? 0) >= 5;

  return (
    <div className={classes.block}>
      <h3 className={classes.h3}>{copy.title}</h3>
      <p className={classes.muted}>{copy.body}</p>

      {loadFailed ? (
        <p className={classes.muted} role="alert">
          {copy.loadFailed}
        </p>
      ) : domains === null ? (
        <p className={classes.muted} aria-live="polite">
          {copy.loading}
        </p>
      ) : (
        <ul className={classes.domainList}>
          {domains.map((row) => {
            const verified = row.status === 'verified';
            return (
              <li key={row.id} className={classes.domainRow} aria-busy={busy?.endsWith(row.id) || undefined}>
                <div className={classes.domainHead}>
                  <code dir="ltr" className={classes.domainName}>
                    {row.domain}
                  </code>
                  {verified ? (
                    <span className={classes.ok}>
                      <GcIcon name="check" size={14} />
                      {copy.status.verified}
                    </span>
                  ) : (
                    <span className={classes.muted}>{row.status === 'failed' ? copy.status.failed : copy.status.pending}</span>
                  )}
                </div>
                {!verified && (
                  <>
                    <p className={classes.muted}>{copy.recordHelp}</p>
                    <div className={classes.record}>
                      <RecordField label={copy.recordType} value="TXT" copy={copy} />
                      <RecordField label={copy.recordName} value={row.txtName} copy={copy} />
                      <RecordField label={copy.recordValue} value={row.txtValue} copy={copy} />
                    </div>
                  </>
                )}
                {rowError?.id === row.id && (
                  <p className={classes.muted} role="alert">
                    {rowError.text}
                  </p>
                )}
                <div className={classes.buttons}>
                  {!verified && (
                    <Button variant="default" radius="pill" loading={busy === `check:${row.id}`} onClick={() => void check(row)}>
                      {copy.check}
                    </Button>
                  )}
                  <Button variant="subtle" color="danger" loading={busy === `remove:${row.id}`} onClick={() => void remove(row)}>
                    {copy.remove}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {domains !== null && !full && (
        <form className={classes.domainForm} onSubmit={(event) => void add(event)} noValidate>
          <TextInput
            id={inputId}
            label={copy.label}
            placeholder="shop.example.com"
            value={input}
            onChange={(event) => setInput(event.currentTarget.value)}
            error={inputError}
            dir="ltr"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className={classes.domainInput}
          />
          <Button type="submit" radius="pill" loading={busy === 'add'} leftSection={<GcIcon name="plus" size={14} />}>
            {copy.add}
          </Button>
        </form>
      )}
      {domains !== null && <p className={classes.muted}>{full ? copy.errors.limit_reached : copy.wwwHint}</p>}
    </div>
  );
}
