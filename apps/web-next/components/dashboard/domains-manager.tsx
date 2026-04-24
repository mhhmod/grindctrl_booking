'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { DomainsState } from '@/app/dashboard/domains/state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DOMAIN_STATUS_OPTIONS, getDomainStatusTone, isValidDomainInput, normalizeDomainInput } from '@/lib/domains';

const inputClassName = 'h-9 rounded-4xl';
const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function DomainsManager({
  initialState,
  addDomainAction,
  updateDomainStatusAction,
  removeDomainAction,
  allowLocalhost,
}: {
  initialState: DomainsState;
  addDomainAction: (formData: FormData) => Promise<DomainsState>;
  updateDomainStatusAction: (formData: FormData) => Promise<DomainsState>;
  removeDomainAction: (formData: FormData) => Promise<DomainsState>;
  allowLocalhost: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [domainDraft, setDomainDraft] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(initialState.fieldError);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setState(initialState);
    setDomainDraft('');
    setInlineError(initialState.fieldError);
    setPendingAction(null);
  }, [initialState]);

  const submitAddDomain = () => {
    const normalized = normalizeDomainInput(domainDraft);
    if (!isValidDomainInput(normalized)) {
      setInlineError('Enter a valid hostname like example.com.');
      return;
    }

    const formData = new FormData();
    formData.set('domain', normalized);

    setInlineError(null);
    setPendingAction('add');
    startTransition(async () => {
      const nextState = await addDomainAction(formData);
      setState(nextState);
      setInlineError(nextState.fieldError);
      if (nextState.messageType === 'success') {
        setDomainDraft('');
      }
      setPendingAction(null);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Allowed domains</CardTitle>
            <CardDescription>Manage the hostnames that can run the public widget for this site.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">Real backend contract</Badge>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border bg-muted/10 p-4">
            <Label htmlFor="domain">Add domain</Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <Input
                id="domain"
                name="domain"
                placeholder="example.com"
                aria-invalid={inlineError ? 'true' : 'false'}
                aria-describedby={inlineError ? 'domain-inline-error' : undefined}
                className={inputClassName}
                value={domainDraft}
                onChange={(event) => {
                  setDomainDraft(event.target.value);
                  if (inlineError) {
                    setInlineError(isValidDomainInput(normalizeDomainInput(event.target.value)) ? null : inlineError);
                  }
                }}
              />
              <Button
                type="button"
                disabled={isPending && pendingAction === 'add'}
                onClick={submitAddDomain}
              >
                {isPending && pendingAction === 'add' ? 'Adding...' : 'Add domain'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Enter a bare hostname only. No protocol, port, path, or wildcard. `localhost` and `127.0.0.1` are treated as development hosts.</p>
            {inlineError ? <p id="domain-inline-error" className="mt-3 text-sm text-destructive">{inlineError}</p> : null}
          </div>

          <div className="mt-4 min-h-6 text-sm" role="status" aria-live="polite">
            {isPending ? <span className="text-muted-foreground">Saving domain changes...</span> : null}
            {!isPending && state.message ? <span className={state.messageType === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>{state.message}</span> : null}
          </div>

          {state.domains.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No domains configured yet.</p>
              <p className="mt-2 leading-6">Add at least one production hostname before shipping the install snippet to customer sites.</p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {state.domains.map((domain) => {
                const statusFormId = `status-${domain.id}`;
                const removeFormId = `remove-${domain.id}`;

                return (
                  <li key={domain.id} className="rounded-lg border bg-muted/10 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground" dir="ltr">{domain.domain}</div>
                        <Badge variant="outline" className={`mt-2 capitalize ${getDomainStatusTone(domain.verification_status)}`}>
                          {domain.verification_status}
                        </Badge>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <form
                          id={statusFormId}
                          className="min-w-48"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const formData = new FormData(event.currentTarget);
                            setPendingAction(`status:${domain.id}`);
                            startTransition(async () => {
                              const nextState = await updateDomainStatusAction(formData);
                              setState(nextState);
                              setInlineError(nextState.fieldError);
                              setPendingAction(null);
                            });
                          }}
                        >
                          <input type="hidden" name="domainId" value={domain.id} />
                          <Label htmlFor={`status-${domain.id}-select`}>Status</Label>
                          <select id={`status-${domain.id}-select`} key={`${domain.id}:${domain.verification_status}`} name="status" defaultValue={domain.verification_status} className={selectClassName}>
                            {DOMAIN_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </form>

                        <div className="flex gap-3">
                          <Button
                            type="submit"
                            form={statusFormId}
                            variant="outline"
                            disabled={isPending && pendingAction === `status:${domain.id}`}
                          >
                            {isPending && pendingAction === `status:${domain.id}` ? 'Saving...' : 'Save status'}
                          </Button>

                          <form
                            id={removeFormId}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const formData = new FormData(event.currentTarget);
                              setPendingAction(`remove:${domain.id}`);
                              startTransition(async () => {
                                const nextState = await removeDomainAction(formData);
                                setState(nextState);
                                setInlineError(nextState.fieldError);
                                setPendingAction(null);
                              });
                            }}
                          >
                            <input type="hidden" name="domainId" value={domain.id} />
                          </form>
                          <Button
                            type="submit"
                            form={removeFormId}
                            variant="destructive"
                            disabled={isPending && pendingAction === `remove:${domain.id}`}
                            onClick={(event) => {
                              if (!window.confirm(`Remove ${domain.domain} from allowed domains?`)) {
                                event.preventDefault();
                              }
                            }}
                          >
                            {isPending && pendingAction === `remove:${domain.id}` ? 'Removing...' : 'Remove'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Install safety</CardTitle>
            <CardDescription>Verified production domains control where the public widget should initialize. Pending or failed entries need follow-up before rollout.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              <li className="rounded-lg border bg-muted/10 p-4">Configured hostnames: {state.domains.length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Verified hostnames: {state.domains.filter((domain) => domain.verification_status === 'verified').length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Local development: {allowLocalhost ? 'localhost is currently allowed.' : 'localhost protection is disabled in settings_json.'}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">Pending</span><p className="mt-2 text-muted-foreground">Use while a hostname is being prepared but should not yet be treated as production-safe.</p></div>
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">Verified</span><p className="mt-2 text-muted-foreground">Safe state for live installs. This is the target before sharing the snippet broadly.</p></div>
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">Failed or disabled</span><p className="mt-2 text-muted-foreground">Use when a hostname should stop being trusted or the validation/setup is incomplete.</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
