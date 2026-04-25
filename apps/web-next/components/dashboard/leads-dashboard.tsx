'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import { LEADS_PAGE_SIZE_OPTIONS, LEADS_SORT_OPTIONS, type LeadsSortOption } from '@/lib/dashboard/leads-list-query';
import type { WidgetLead } from '@/lib/types';
import { LEAD_CAPTURE_TIMING_OPTIONS, LEAD_CONSENT_MODE_OPTIONS, LEAD_DEDUPE_MODE_OPTIONS, LEAD_FIELD_OPTIONS, type LeadSettingsViewModel } from '@/lib/view-models/leads';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFormFeedback } from '@/components/dashboard/form-feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClassName = 'w-full min-h-24 resize-y rounded-2xl border border-input bg-input/30 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const checkboxClassName = 'mt-1 size-4 rounded border-input bg-input/30 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export interface LeadsListState {
  status: 'loading' | 'success' | 'error';
  leads: WidgetLead[];
  message: string | null;
  query: string;
  sort: LeadsSortOption;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  filteredCount: number;
  totalCount: number;
}

const LEADS_SORT_LABELS: Record<LeadsSortOption, string> = {
  captured_desc: 'Captured date (newest)',
  captured_asc: 'Captured date (oldest)',
  name_asc: 'Lead name (A-Z)',
  name_desc: 'Lead name (Z-A)',
};

function isOptionalUrlValid(value: string) {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isLeadSettingsEqual(left: LeadSettingsViewModel, right: LeadSettingsViewModel) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatLeadDate(value?: string) {
  if (!value) return 'Unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function updateValue(values: LeadSettingsViewModel, key: keyof LeadSettingsViewModel, value: string | boolean | string[]): LeadSettingsViewModel {
  return { ...values, [key]: value };
}

function toggleField(list: string[], field: string, checked: boolean) {
  if (checked) return Array.from(new Set([...list, field]));
  return list.filter((entry) => entry !== field);
}

export function LeadsDashboard({
  initialSettingsState,
  saveSettingsAction,
  leadsState,
  selectedSiteId,
}: {
  initialSettingsState: LeadSettingsFormState;
  saveSettingsAction: (formData: FormData) => Promise<LeadSettingsFormState>;
  leadsState: LeadsListState;
  selectedSiteId: string;
}) {
  return (
    <LeadsDashboardInner
      key={JSON.stringify(initialSettingsState)}
      initialSettingsState={initialSettingsState}
      saveSettingsAction={saveSettingsAction}
      leadsState={leadsState}
      selectedSiteId={selectedSiteId}
    />
  );
}

function LeadsDashboardInner({
  initialSettingsState,
  saveSettingsAction,
  leadsState,
  selectedSiteId,
}: {
  initialSettingsState: LeadSettingsFormState;
  saveSettingsAction: (formData: FormData) => Promise<LeadSettingsFormState>;
  leadsState: LeadsListState;
  selectedSiteId: string;
}) {
  const [settingsState, setSettingsState] = useState(initialSettingsState);
  const [values, setValues] = useState(initialSettingsState.values);
  const [savedValues, setSavedValues] = useState(initialSettingsState.values);
  const [isPending, startTransition] = useTransition();

  const consentTextInvalid = values.consentMode !== 'none' && !values.consentText.trim();
  const privacyUrlInvalid = values.privacyUrl.trim().length > 0 && !isOptionalUrlValid(values.privacyUrl);
  const validationMessage =
    (consentTextInvalid ? 'Consent text is required when consent mode is optional or required.' : null)
    ?? (privacyUrlInvalid ? 'Use a valid http/https URL for the privacy policy field.' : null);

  const isDirty = !isLeadSettingsEqual(values, savedValues);

  function buildLeadsHref(next: {
    q?: string;
    sort?: LeadsSortOption;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();

    if (selectedSiteId) {
      params.set('site', selectedSiteId);
    }

    const nextQuery = (next.q ?? leadsState.query).trim();
    const nextSort = next.sort ?? leadsState.sort;
    const nextPage = next.page ?? leadsState.page;
    const nextPageSize = next.pageSize ?? leadsState.pageSize;

    if (nextQuery) {
      params.set('q', nextQuery);
    }
    if (nextSort !== 'captured_desc') {
      params.set('sort', nextSort);
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    if (nextPageSize !== 10) {
      params.set('pageSize', String(nextPageSize));
    }

    const queryString = params.toString();
    return queryString ? `/dashboard/leads?${queryString}` : '/dashboard/leads';
  }

  const enabledFieldCount = values.fields.length;
  const requiredFieldCount = values.requiredFields.length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Lead capture settings</CardTitle>
            <CardDescription>Edit the active widget site lead capture subset through the canonical `settings_json` contract only.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">Authority: `settings_json`</Badge>
        </CardHeader>

        <CardContent>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();

              if (!isDirty || validationMessage) {
                return;
              }

              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const nextState = await saveSettingsAction(formData);
                setSettingsState(nextState);
                setValues(nextState.values);
                if (nextState.status === 'success') {
                  setSavedValues(nextState.values);
                }
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border bg-muted/10 p-4 md:col-span-2">
                <input
                  id="lead-enabled"
                  name="enabled"
                  type="checkbox"
                  className={checkboxClassName}
                  checked={values.enabled}
                  onChange={(event) => setValues((current) => updateValue(current, 'enabled', event.target.checked))}
                />
                <div>
                  <Label htmlFor="lead-enabled">Enable lead capture</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Keeps public lead submission authority on the backend while this screen edits only the capture configuration.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="captureTiming">Capture timing</Label>
                <select id="captureTiming" name="captureTiming" className={selectClassName} value={values.captureTiming} onChange={(event) => setValues((current) => updateValue(current, 'captureTiming', event.target.value))}>
                  {LEAD_CAPTURE_TIMING_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dedupeMode">Dedupe mode</Label>
                <select id="dedupeMode" name="dedupeMode" className={selectClassName} value={values.dedupeMode} onChange={(event) => setValues((current) => updateValue(current, 'dedupeMode', event.target.value))}>
                  {LEAD_DEDUPE_MODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="promptTitle">Prompt title</Label>
                <Input id="promptTitle" name="promptTitle" value={values.promptTitle} onChange={(event) => setValues((current) => updateValue(current, 'promptTitle', event.target.value))} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="promptSubtitle">Prompt subtitle</Label>
                <textarea id="promptSubtitle" name="promptSubtitle" className={textareaClassName} value={values.promptSubtitle} onChange={(event) => setValues((current) => updateValue(current, 'promptSubtitle', event.target.value))} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <fieldset className="rounded-lg border bg-muted/10 p-4">
                <legend className="px-2 text-sm font-medium text-foreground">Enabled fields</legend>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {LEAD_FIELD_OPTIONS.map((field) => (
                    <label key={field} className="flex items-center gap-3 rounded-lg border px-3 py-3">
                      <input
                        name="fields"
                        type="checkbox"
                        value={field}
                        className={checkboxClassName}
                        checked={values.fields.includes(field)}
                        onChange={(event) => {
                          const fields = toggleField(values.fields, field, event.target.checked);
                          const requiredFields = values.requiredFields.filter((entry) => fields.includes(entry));
                          setValues((current) => ({ ...current, fields, requiredFields }));
                        }}
                      />
                      <span className="capitalize">{field}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-lg border bg-muted/10 p-4">
                <legend className="px-2 text-sm font-medium text-foreground">Required fields</legend>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {LEAD_FIELD_OPTIONS.map((field) => {
                    const disabled = !values.fields.includes(field);

                    return (
                      <label key={field} className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${disabled ? 'opacity-50' : ''}`}>
                        <input
                          name="requiredFields"
                          type="checkbox"
                          value={field}
                          className={checkboxClassName}
                          disabled={disabled}
                          checked={values.requiredFields.includes(field)}
                          onChange={(event) => setValues((current) => updateValue(current, 'requiredFields', toggleField(current.requiredFields, field, event.target.checked)))}
                        />
                        <span className="capitalize">{field}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="consentMode">Consent mode</Label>
                <select id="consentMode" name="consentMode" className={selectClassName} value={values.consentMode} onChange={(event) => setValues((current) => updateValue(current, 'consentMode', event.target.value))}>
                  {LEAD_CONSENT_MODE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-muted/10 p-4">
                <input
                  id="skippable"
                  name="skippable"
                  type="checkbox"
                  className={checkboxClassName}
                  checked={values.skippable}
                  onChange={(event) => setValues((current) => updateValue(current, 'skippable', event.target.checked))}
                />
                <div>
                  <Label htmlFor="skippable">Allow visitors to skip</Label>
                  <p className="mt-1 text-sm text-muted-foreground">Useful for post-chat capture when you want a softer gate.</p>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="consentText">Consent copy</Label>
                <textarea
                  id="consentText"
                  name="consentText"
                  className={textareaClassName}
                  value={values.consentText}
                  aria-invalid={consentTextInvalid ? 'true' : 'false'}
                  aria-describedby={consentTextInvalid ? 'lead-settings-inline-error' : undefined}
                  onChange={(event) => setValues((current) => updateValue(current, 'consentText', event.target.value))}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="privacyUrl">Privacy policy URL</Label>
                <Input
                  id="privacyUrl"
                  name="privacyUrl"
                  type="url"
                  value={values.privacyUrl}
                  aria-invalid={privacyUrlInvalid ? 'true' : 'false'}
                  aria-describedby={privacyUrlInvalid ? 'lead-settings-inline-error' : undefined}
                  onChange={(event) => setValues((current) => updateValue(current, 'privacyUrl', event.target.value))}
                />
              </div>
            </div>

            {validationMessage ? (
              <p id="lead-settings-inline-error" className="text-sm text-destructive">
                {validationMessage}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DashboardFormFeedback
                isPending={isPending}
                pendingMessage="Saving lead capture settings..."
                message={validationMessage ?? settingsState.message ?? (!isDirty ? 'No unsaved changes.' : null)}
                tone={validationMessage ? 'error' : settingsState.status === 'error' ? 'error' : settingsState.status === 'success' ? 'success' : null}
              />

              <Button type="submit" disabled={isPending || !isDirty || Boolean(validationMessage)}>
                {isPending ? 'Saving...' : 'Save lead settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lead capture summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-sm text-muted-foreground">Status</dt><dd className="mt-2 text-sm text-foreground">{values.enabled ? 'Enabled' : 'Disabled'}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-sm text-muted-foreground">Capture timing</dt><dd className="mt-2 text-sm text-foreground">{values.captureTiming.replace('_', ' ')}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-sm text-muted-foreground">Enabled fields</dt><dd className="mt-2 text-sm text-foreground">{enabledFieldCount}</dd></div>
              <div className="rounded-lg border bg-muted/10 p-4"><dt className="text-sm text-muted-foreground">Required fields</dt><dd className="mt-2 text-sm text-foreground">{requiredFieldCount}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle>Captured leads</CardTitle>
              <CardDescription>Loaded from the existing backend-controlled `dashboard_list_leads` contract. This screen does not create leads in the browser.</CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">Read path: `dashboard_list_leads`</Badge>
          </CardHeader>

          <CardContent>
            <form method="get" action="/dashboard/leads" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_140px_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="lead-search">Search leads</Label>
                <Input id="lead-search" name="q" defaultValue={leadsState.query} placeholder="Search name, email, company, phone, or source" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-sort">Sort by</Label>
                <select id="lead-sort" name="sort" className={selectClassName} defaultValue={leadsState.sort}>
                  {LEADS_SORT_OPTIONS.map((sort) => (
                    <option key={sort} value={sort}>
                      {LEADS_SORT_LABELS[sort]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-page-size">Rows</Label>
                <select id="lead-page-size" name="pageSize" className={selectClassName} defaultValue={String(leadsState.pageSize)}>
                  {LEADS_PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit">Apply</Button>
                <Button asChild type="button" variant="outline">
                  <Link href={buildLeadsHref({ q: '', sort: 'captured_desc', page: 1, pageSize: 10 })}>Clear</Link>
                </Button>
              </div>

              <input type="hidden" name="site" value={selectedSiteId} />
              <input type="hidden" name="page" value="1" />
            </form>

            {leadsState.status === 'loading' ? (
              <div className="mt-4 grid gap-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : null}

            {leadsState.status === 'error' ? (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Unable to load leads.</AlertTitle>
                <AlertDescription>{leadsState.message ?? 'The existing leads read contract returned an error.'}</AlertDescription>
              </Alert>
            ) : null}

            {leadsState.status === 'success' && leadsState.filteredCount === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{leadsState.totalCount === 0 ? 'No leads captured yet.' : 'No leads match the current search.'}</p>
                <p className="mt-2 leading-6">{leadsState.totalCount === 0 ? 'Lead submission remains backend and Edge controlled. New rows will appear here when the existing runtime captures them.' : 'Try a different search term or clear the filter.'}</p>
              </div>
            ) : null}

            {leadsState.status === 'success' && leadsState.filteredCount > 0 ? (
              <>
                <div className="mt-4 flex flex-col gap-3 border-b pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Showing <span className="font-medium text-foreground">{leadsState.startIndex}-{leadsState.endIndex}</span> of{' '}
                    <span className="font-medium text-foreground">{leadsState.filteredCount}</span> matched leads
                    {leadsState.filteredCount !== leadsState.totalCount ? ` (${leadsState.totalCount} total)` : ''}.
                  </p>
                  <p>
                    Page <span className="font-medium text-foreground">{leadsState.page}</span> of{' '}
                    <span className="font-medium text-foreground">{leadsState.totalPages}</span>
                  </p>
                </div>

                <ul className="mt-4 grid gap-3 md:hidden">
                  {leadsState.leads.map((lead) => (
                    <li key={lead.id} className="rounded-lg border bg-muted/10 p-4">
                      <div className="text-sm font-medium text-foreground">{lead.name ?? lead.email ?? 'Unnamed lead'}</div>
                      <dl className="mt-3 grid gap-2 text-sm">
                        <div><dt className="text-muted-foreground">Email</dt><dd className="text-foreground" dir="ltr">{lead.email ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Company</dt><dd className="text-foreground">{lead.company ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Phone</dt><dd className="text-foreground" dir="ltr">{lead.phone ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Source</dt><dd className="text-foreground" dir="ltr">{lead.source_domain ?? '—'}</dd></div>
                        <div><dt className="text-muted-foreground">Captured</dt><dd className="text-foreground">{formatLeadDate(lead.created_at)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 hidden rounded-lg border md:block">
                  <Table>
                    <TableHeader className="text-muted-foreground">
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Captured</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leadsState.leads.map((lead) => (
                        <TableRow key={lead.id} className="align-top">
                          <TableCell>
                            <div className="font-medium text-foreground">{lead.name ?? 'Unnamed lead'}</div>
                            <div className="mt-1 text-muted-foreground" dir="ltr">{lead.email ?? '—'}</div>
                          </TableCell>
                          <TableCell className="text-foreground">{lead.company ?? '—'}</TableCell>
                          <TableCell className="text-foreground" dir="ltr">{lead.phone ?? '—'}</TableCell>
                          <TableCell className="text-foreground" dir="ltr">{lead.source_domain ?? '—'}</TableCell>
                          <TableCell className="text-foreground">{formatLeadDate(lead.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  {leadsState.page > 1 ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildLeadsHref({ page: leadsState.page - 1 })}>Previous</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                  )}

                  {leadsState.page < leadsState.totalPages ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={buildLeadsHref({ page: leadsState.page + 1 })}>Next</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Next
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
