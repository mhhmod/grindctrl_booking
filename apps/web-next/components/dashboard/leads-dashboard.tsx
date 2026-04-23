'use client';

import React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { LeadSettingsFormState } from '@/app/dashboard/leads/state';
import type { WidgetLead } from '@/lib/types';
import { LEAD_CAPTURE_TIMING_OPTIONS, LEAD_CONSENT_MODE_OPTIONS, LEAD_DEDUPE_MODE_OPTIONS, LEAD_FIELD_OPTIONS, type LeadSettingsViewModel } from '@/lib/view-models/leads';

const inputClassName = 'mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600';

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
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Lead capture settings</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Edit the active widget site lead capture subset through the canonical `settings_json` contract only.</p>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">Authority: `settings_json`</div>
        </div>

        <form
          className="mt-6 grid gap-6"
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
            <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300 md:col-span-2">
              <input
                name="enabled"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200"
                checked={values.enabled}
                onChange={(event) => setValues((current) => updateValue(current, 'enabled', event.target.checked))}
              />
              <span>
                Enable lead capture
                <span className="mt-1 block text-zinc-500">Keeps public lead submission authority on the backend while this screen edits only the capture configuration.</span>
              </span>
            </label>

            <label className="block text-sm text-zinc-300">
              Capture timing
              <select name="captureTiming" className={inputClassName} value={values.captureTiming} onChange={(event) => setValues((current) => updateValue(current, 'captureTiming', event.target.value))}>
                {LEAD_CAPTURE_TIMING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-300">
              Dedupe mode
              <select name="dedupeMode" className={inputClassName} value={values.dedupeMode} onChange={(event) => setValues((current) => updateValue(current, 'dedupeMode', event.target.value))}>
                {LEAD_DEDUPE_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-300 md:col-span-2">
              Prompt title
              <input name="promptTitle" className={inputClassName} value={values.promptTitle} onChange={(event) => setValues((current) => updateValue(current, 'promptTitle', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300 md:col-span-2">
              Prompt subtitle
              <textarea name="promptSubtitle" className={inputClassName + ' min-h-24 resize-y'} value={values.promptSubtitle} onChange={(event) => setValues((current) => updateValue(current, 'promptSubtitle', event.target.value))} />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <legend className="px-2 text-sm font-medium text-zinc-100">Enabled fields</legend>
              <div className="mt-3 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                {LEAD_FIELD_OPTIONS.map((field) => (
                  <label key={field} className="flex items-center gap-3 rounded-xl border border-zinc-800 px-3 py-3">
                    <input
                      name="fields"
                      type="checkbox"
                      value={field}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200"
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

            <fieldset className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <legend className="px-2 text-sm font-medium text-zinc-100">Required fields</legend>
              <div className="mt-3 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                {LEAD_FIELD_OPTIONS.map((field) => {
                  const disabled = !values.fields.includes(field);

                  return (
                    <label key={field} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${disabled ? 'border-zinc-900 text-zinc-600' : 'border-zinc-800'}`}>
                      <input
                        name="requiredFields"
                        type="checkbox"
                        value={field}
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200"
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
            <label className="block text-sm text-zinc-300">
              Consent mode
              <select name="consentMode" className={inputClassName} value={values.consentMode} onChange={(event) => setValues((current) => updateValue(current, 'consentMode', event.target.value))}>
                {LEAD_CONSENT_MODE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
              <input
                name="skippable"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-zinc-200"
                checked={values.skippable}
                onChange={(event) => setValues((current) => updateValue(current, 'skippable', event.target.checked))}
              />
              <span>
                Allow visitors to skip
                <span className="mt-1 block text-zinc-500">Useful for post-chat capture when you want a softer gate.</span>
              </span>
            </label>

            <label className="block text-sm text-zinc-300 md:col-span-2">
              Consent copy
              <textarea name="consentText" className={inputClassName + ' min-h-24 resize-y'} value={values.consentText} onChange={(event) => setValues((current) => updateValue(current, 'consentText', event.target.value))} />
            </label>

            <label className="block text-sm text-zinc-300 md:col-span-2">
              Privacy policy URL
              <input name="privacyUrl" type="url" className={inputClassName} value={values.privacyUrl} onChange={(event) => setValues((current) => updateValue(current, 'privacyUrl', event.target.value))} />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-6 text-sm" role="status" aria-live="polite">
              {isPending ? <span className="text-zinc-400">Saving lead capture settings...</span> : null}
              {!isPending && settingsState.message ? <span className={settingsState.status === 'error' ? 'text-rose-300' : 'text-emerald-300'}>{settingsState.message}</span> : null}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {isPending ? 'Saving...' : 'Save lead settings'}
            </button>
          </div>
        </form>
      </section>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Lead capture summary</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-sm text-zinc-500">Status</dt><dd className="mt-2 text-sm text-zinc-100">{values.enabled ? 'Enabled' : 'Disabled'}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-sm text-zinc-500">Capture timing</dt><dd className="mt-2 text-sm text-zinc-100">{values.captureTiming.replace('_', ' ')}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-sm text-zinc-500">Enabled fields</dt><dd className="mt-2 text-sm text-zinc-100">{enabledFieldCount}</dd></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><dt className="text-sm text-zinc-500">Required fields</dt><dd className="mt-2 text-sm text-zinc-100">{requiredFieldCount}</dd></div>
          </dl>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Captured leads</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Loaded from the existing backend-controlled `dashboard_list_leads` contract. This screen does not create leads in the browser.</p>
            </div>
            <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">Read path: `dashboard_list_leads`</div>
          </div>

          <div className="mt-5">
            <label className="block text-sm text-zinc-300">
              Search leads
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, company, phone, or source" className={inputClassName} />
            </label>
          </div>

          {leadsState.status === 'loading' ? (
            <div className="mt-4 grid gap-3">
              <div className="h-24 animate-pulse rounded-2xl bg-zinc-950" />
              <div className="h-24 animate-pulse rounded-2xl bg-zinc-950" />
            </div>
          ) : null}

          {leadsState.status === 'error' ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-200">
              <p className="font-medium">Unable to load leads.</p>
              <p className="mt-2 leading-6 text-rose-100/80">{leadsState.message ?? 'The existing leads read contract returned an error.'}</p>
            </div>
          ) : null}

          {leadsState.status === 'success' && filteredLeads.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-400">
              <p className="font-medium text-zinc-200">{leadsState.leads.length === 0 ? 'No leads captured yet.' : 'No leads match the current search.'}</p>
              <p className="mt-2 leading-6">{leadsState.leads.length === 0 ? 'Lead submission remains backend and Edge controlled. New rows will appear here when the existing runtime captures them.' : 'Try a different search term or clear the filter.'}</p>
            </div>
          ) : null}

          {leadsState.status === 'success' && filteredLeads.length > 0 ? (
            <>
              <ul className="mt-4 grid gap-3 md:hidden">
                {filteredLeads.map((lead) => (
                  <li key={lead.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-sm font-medium text-zinc-100">{lead.name ?? lead.email ?? 'Unnamed lead'}</div>
                    <dl className="mt-3 grid gap-2 text-sm text-zinc-300">
                      <div><dt className="text-zinc-500">Email</dt><dd>{lead.email ?? '—'}</dd></div>
                      <div><dt className="text-zinc-500">Company</dt><dd>{lead.company ?? '—'}</dd></div>
                      <div><dt className="text-zinc-500">Phone</dt><dd>{lead.phone ?? '—'}</dd></div>
                      <div><dt className="text-zinc-500">Source</dt><dd>{lead.source_domain ?? '—'}</dd></div>
                      <div><dt className="text-zinc-500">Captured</dt><dd>{formatLeadDate(lead.created_at)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>

              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 md:block">
                <table className="min-w-full text-left text-sm text-zinc-300">
                  <thead className="border-b border-zinc-800 text-zinc-500">
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
                      <tr key={lead.id} className="border-b border-zinc-900 last:border-b-0 align-top">
                        <td className="px-4 py-4">
                          <div className="font-medium text-zinc-100">{lead.name ?? 'Unnamed lead'}</div>
                          <div className="mt-1 text-zinc-500">{lead.email ?? '—'}</div>
                        </td>
                        <td className="px-4 py-4">{lead.company ?? '—'}</td>
                        <td className="px-4 py-4">{lead.phone ?? '—'}</td>
                        <td className="px-4 py-4">{lead.source_domain ?? '—'}</td>
                        <td className="px-4 py-4">{formatLeadDate(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
