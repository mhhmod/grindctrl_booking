'use client';

import React from 'react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import type { DomainsState } from '@/app/dashboard/domains/state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFormFeedback } from '@/components/dashboard/form-feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DOMAIN_STATUS_OPTIONS, getDomainStatusTone, isValidDomainInput, normalizeDomainInput } from '@/lib/domains';
import { DOMAINS_PAGE_SIZE_OPTIONS, DOMAINS_SORT_OPTIONS, type DomainsListQuery, resolveDomainsList } from '@/lib/dashboard/domains-list-query';

const inputClassName = 'h-9 rounded-4xl';
const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const DOMAIN_SORT_LABELS: Record<(typeof DOMAINS_SORT_OPTIONS)[number], string> = {
  domain_asc: 'Domain (A-Z)',
  domain_desc: 'Domain (Z-A)',
  status_asc: 'Status (A-Z)',
  status_desc: 'Status (Z-A)',
};

export function DomainsManager({
  initialState,
  addDomainAction,
  updateDomainStatusAction,
  removeDomainAction,
  allowLocalhost,
  selectedSiteId,
  listQuery,
}: {
  initialState: DomainsState;
  addDomainAction: (formData: FormData) => Promise<DomainsState>;
  updateDomainStatusAction: (formData: FormData) => Promise<DomainsState>;
  removeDomainAction: (formData: FormData) => Promise<DomainsState>;
  allowLocalhost: boolean;
  selectedSiteId: string;
  listQuery: DomainsListQuery;
}) {
  return (
    <DomainsManagerInner
      key={JSON.stringify(initialState)}
      initialState={initialState}
      addDomainAction={addDomainAction}
      updateDomainStatusAction={updateDomainStatusAction}
      removeDomainAction={removeDomainAction}
      allowLocalhost={allowLocalhost}
      selectedSiteId={selectedSiteId}
      listQuery={listQuery}
    />
  );
}

function DomainsManagerInner({
  initialState,
  addDomainAction,
  updateDomainStatusAction,
  removeDomainAction,
  allowLocalhost,
  selectedSiteId,
  listQuery,
}: {
  initialState: DomainsState;
  addDomainAction: (formData: FormData) => Promise<DomainsState>;
  updateDomainStatusAction: (formData: FormData) => Promise<DomainsState>;
  removeDomainAction: (formData: FormData) => Promise<DomainsState>;
  allowLocalhost: boolean;
  selectedSiteId: string;
  listQuery: DomainsListQuery;
}) {
  const [state, setState] = useState(initialState);
  const [domainDraft, setDomainDraft] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(initialState.fieldError);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initialState.domains.map((domain) => [domain.id, domain.verification_status])));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedDomains = useMemo(() => resolveDomainsList(state.domains, listQuery), [state.domains, listQuery]);

  function buildDomainsHref(next: {
    q?: string;
    status?: DomainsListQuery['status'];
    sort?: DomainsListQuery['sort'];
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    params.set('site', selectedSiteId);

    const nextQuery = (next.q ?? listQuery.q).trim();
    const nextStatus = next.status ?? listQuery.status;
    const nextSort = next.sort ?? listQuery.sort;
    const nextPage = next.page ?? resolvedDomains.page;
    const nextPageSize = next.pageSize ?? listQuery.pageSize;

    if (nextQuery) {
      params.set('q', nextQuery);
    }
    if (nextStatus !== 'all') {
      params.set('status', nextStatus);
    }
    if (nextSort !== 'domain_asc') {
      params.set('sort', nextSort);
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    if (nextPageSize !== 10) {
      params.set('pageSize', String(nextPageSize));
    }

    const queryString = params.toString();
    return queryString ? `/dashboard/domains?${queryString}` : '/dashboard/domains';
  }

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
      setStatusDrafts(Object.fromEntries(nextState.domains.map((domain) => [domain.id, domain.verification_status])));
      setInlineError(nextState.fieldError);
      if (nextState.messageType === 'success') {
        setDomainDraft('');
      }
      setPendingAction(null);
    });
  };

  const normalizedDomainDraft = normalizeDomainInput(domainDraft);
  const domainDraftHasValue = normalizedDomainDraft.length > 0;

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
                disabled={(isPending && pendingAction === 'add') || !domainDraftHasValue}
                onClick={submitAddDomain}
              >
                {isPending && pendingAction === 'add' ? 'Adding...' : 'Add domain'}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Enter a bare hostname only. No protocol, port, path, or wildcard. `localhost` and `127.0.0.1` are treated as development hosts.</p>
            {inlineError ? <p id="domain-inline-error" className="mt-3 text-sm text-destructive">{inlineError}</p> : null}
          </div>

          <DashboardFormFeedback
            className="mt-4"
            isPending={isPending}
            pendingMessage="Saving domain changes..."
            message={state.message}
            tone={state.messageType}
          />

          <form method="get" action="/dashboard/domains" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px_120px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="domain-query">Search domains</Label>
              <Input id="domain-query" name="q" defaultValue={listQuery.q} placeholder="Find by domain or status" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain-status-filter">Status filter</Label>
              <select id="domain-status-filter" name="status" className={selectClassName} defaultValue={listQuery.status}>
                <option value="all">All statuses</option>
                {DOMAIN_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain-sort">Sort by</Label>
              <select id="domain-sort" name="sort" className={selectClassName} defaultValue={listQuery.sort}>
                {DOMAINS_SORT_OPTIONS.map((sort) => (
                  <option key={sort} value={sort}>
                    {DOMAIN_SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain-page-size">Rows</Label>
              <select id="domain-page-size" name="pageSize" className={selectClassName} defaultValue={String(listQuery.pageSize)}>
                {DOMAINS_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline">
                <Link href={buildDomainsHref({ q: '', status: 'all', sort: 'domain_asc', page: 1, pageSize: 10 })}>Clear</Link>
              </Button>
            </div>

            <input type="hidden" name="site" value={selectedSiteId} />
            <input type="hidden" name="page" value="1" />
          </form>

          {resolvedDomains.totalItems === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{state.domains.length === 0 ? 'No domains configured yet.' : 'No domains match the current filters.'}</p>
              <p className="mt-2 leading-6">{state.domains.length === 0 ? 'Add at least one production hostname before shipping the install snippet to customer sites.' : 'Try adjusting the search, status filter, or sorting.'}</p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3 border-b pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing <span className="font-medium text-foreground">{resolvedDomains.startIndex}-{resolvedDomains.endIndex}</span> of{' '}
                  <span className="font-medium text-foreground">{resolvedDomains.totalItems}</span> matched domains
                  {resolvedDomains.totalItems !== state.domains.length ? ` (${state.domains.length} total)` : ''}.
                </p>
                <p>
                  Page <span className="font-medium text-foreground">{resolvedDomains.page}</span> of{' '}
                  <span className="font-medium text-foreground">{resolvedDomains.totalPages}</span>
                </p>
              </div>

              <ul className="mt-4 grid gap-3">
                {resolvedDomains.items.map((domain) => {
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

                            const nextStatus = statusDrafts[domain.id] ?? domain.verification_status;
                            if (nextStatus === domain.verification_status) {
                              return;
                            }

                            const formData = new FormData(event.currentTarget);
                            setPendingAction(`status:${domain.id}`);
                            startTransition(async () => {
                              const nextState = await updateDomainStatusAction(formData);
                              setState(nextState);
                              setStatusDrafts(Object.fromEntries(nextState.domains.map((entry) => [entry.id, entry.verification_status])));
                              setInlineError(nextState.fieldError);
                              setPendingAction(null);
                            });
                          }}
                        >
                          <input type="hidden" name="domainId" value={domain.id} />
                          <Label htmlFor={`status-${domain.id}-select`}>Status</Label>
                          <select
                            id={`status-${domain.id}-select`}
                            name="status"
                            value={statusDrafts[domain.id] ?? domain.verification_status}
                            className={selectClassName}
                            onChange={(event) => {
                              const nextStatus = event.target.value;
                              setStatusDrafts((current) => ({
                                ...current,
                                [domain.id]: nextStatus,
                              }));
                            }}
                          >
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
                            disabled={(isPending && pendingAction === `status:${domain.id}`) || (statusDrafts[domain.id] ?? domain.verification_status) === domain.verification_status}
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
                                setStatusDrafts(Object.fromEntries(nextState.domains.map((entry) => [entry.id, entry.verification_status])));
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

              <div className="mt-4 flex items-center justify-end gap-2">
                {resolvedDomains.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildDomainsHref({ page: resolvedDomains.page - 1 })}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}

                {resolvedDomains.page < resolvedDomains.totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildDomainsHref({ page: resolvedDomains.page + 1 })}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                  </Button>
                )}
              </div>
            </>
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
