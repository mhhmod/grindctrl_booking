'use client';

import React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import type { WidgetLead } from '@/lib/types';
import { LEAD_CAPTURE_TIMING_OPTIONS, LEAD_CONSENT_MODE_OPTIONS, LEAD_DEDUPE_MODE_OPTIONS, LEAD_FIELD_OPTIONS, type LeadSettingsViewModel } from '@/lib/view-models/leads';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClassName = 'w-full min-h-24 resize-y rounded-2xl border border-input bg-input/30 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const checkboxClassName = 'mt-1 size-4 rounded border-input bg-input/30 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export interface LeadsListState {
  status: 'loading' | 'success' | 'error';
  leads: WidgetLead[];
  message: string | null;
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
}: {
  initialSettingsState: LeadSettingsFormState;
  saveSettingsAction: (formData: FormData) => Promise<LeadSettingsFormState>;
  leadsState: LeadsListState;
}) {
  const [settingsState, setSettingsState] = useState(initialSettingsState);
  const [values, setValues] = useState(initialSettingsState.values);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSettingsState(initialSettingsState);
    setValues(initialSettingsState.values);
  }, [initialSettingsState]);

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return leadsState.leads;

    return leadsState.leads.filter((lead) => [lead.name, lead.email, lead.company, lead.phone, lead.source_domain].some((value) => value?.toLowerCase().includes(normalizedQuery)));
  }, [leadsState.leads, query]);

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

              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const nextState = await saveSettingsAction(formData);
                setSettingsState(nextState);
                setValues(nextState.values);
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
                <textarea id="consentText" name="consentText" className={textareaClassName} value={values.consentText} onChange={(event) => setValues((current) => updateValue(current, 'consentText', event.target.value))} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="privacyUrl">Privacy policy URL</Label>
                <Input id="privacyUrl" name="privacyUrl" type="url" value={values.privacyUrl} onChange={(event) => setValues((current) => updateValue(current, 'privacyUrl', event.target.value))} />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-6 text-sm" role="status" aria-live="polite">
                {isPending ? <span className="text-muted-foreground">Saving lead capture settings...</span> : null}
                {!isPending && settingsState.message ? (
                  settingsState.status === 'error' ? (
                    <span className="text-destructive">{settingsState.message}</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">{settingsState.message}</span>
                  )
                ) : null}
              </div>

              <Button type="submit" disabled={isPending}>
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
            <div className="space-y-2">
              <Label htmlFor="lead-search">Search leads</Label>
              <Input id="lead-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, company, phone, or source" />
            </div>

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

            {leadsState.status === 'success' && filteredLeads.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{leadsState.leads.length === 0 ? 'No leads captured yet.' : 'No leads match the current search.'}</p>
                <p className="mt-2 leading-6">{leadsState.leads.length === 0 ? 'Lead submission remains backend and Edge controlled. New rows will appear here when the existing runtime captures them.' : 'Try a different search term or clear the filter.'}</p>
              </div>
            ) : null}

            {leadsState.status === 'success' && filteredLeads.length > 0 ? (
              <>
                <ul className="mt-4 grid gap-3 md:hidden">
                  {filteredLeads.map((lead) => (
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

                <div className="mt-4 hidden overflow-x-auto rounded-lg border md:block">
                  <table className="min-w-full text-start text-sm">
                    <thead className="border-b text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Lead</th>
                        <th className="px-4 py-3 font-medium">Company</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Source</th>
                        <th className="px-4 py-3 font-medium">Captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="border-b last:border-b-0 align-top">
                          <td className="px-4 py-4">
                            <div className="font-medium text-foreground">{lead.name ?? 'Unnamed lead'}</div>
                            <div className="mt-1 text-muted-foreground" dir="ltr">{lead.email ?? '—'}</div>
                          </td>
                          <td className="px-4 py-4 text-foreground">{lead.company ?? '—'}</td>
                          <td className="px-4 py-4 text-foreground" dir="ltr">{lead.phone ?? '—'}</td>
                          <td className="px-4 py-4 text-foreground" dir="ltr">{lead.source_domain ?? '—'}</td>
                          <td className="px-4 py-4 text-foreground">{formatLeadDate(lead.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
