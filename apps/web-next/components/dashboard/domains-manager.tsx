'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { DomainsState } from '@/app/dashboard/domains/actions';
import { DOMAIN_STATUS_OPTIONS, getDomainStatusTone, isValidDomainInput, normalizeDomainInput } from '@/lib/domains';

const inputClassName = 'mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600';

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
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Allowed domains</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Manage the hostnames that can run the public widget for this site.</p>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">Real backend contract</div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <label className="block text-sm text-zinc-300">
            Add domain
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                name="domain"
                placeholder="example.com"
                className={inputClassName + (inlineError ? ' border-rose-500/70 focus:border-rose-500' : '')}
                value={domainDraft}
                onChange={(event) => {
                  setDomainDraft(event.target.value);
                  if (inlineError) {
                    setInlineError(isValidDomainInput(normalizeDomainInput(event.target.value)) ? null : inlineError);
                  }
                }}
              />
              <button
                type="button"
                disabled={isPending && pendingAction === 'add'}
                onClick={submitAddDomain}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {isPending && pendingAction === 'add' ? 'Adding...' : 'Add domain'}
              </button>
            </div>
          </label>
          <p className="mt-3 text-sm text-zinc-500">Enter a bare hostname only. No protocol, port, path, or wildcard. `localhost` and `127.0.0.1` are treated as development hosts.</p>
          {inlineError ? <p className="mt-3 text-sm text-rose-300">{inlineError}</p> : null}
        </div>

        <div className="mt-4 min-h-6 text-sm" role="status" aria-live="polite">
          {isPending ? <span className="text-zinc-400">Saving domain changes...</span> : null}
          {!isPending && state.message ? <span className={state.messageType === 'error' ? 'text-rose-300' : 'text-emerald-300'}>{state.message}</span> : null}
        </div>

        {state.domains.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">No domains configured yet.</p>
            <p className="mt-2 leading-6">Add at least one production hostname before shipping the install snippet to customer sites.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {state.domains.map((domain) => {
              const statusFormId = `status-${domain.id}`;
              const removeFormId = `remove-${domain.id}`;

              return (
                <li key={domain.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{domain.domain}</div>
                      <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getDomainStatusTone(domain.verification_status)}`}>
                        {domain.verification_status}
                      </div>
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
                        <label className="block text-sm text-zinc-400">
                          Status
                          <select key={`${domain.id}:${domain.verification_status}`} name="status" value={domain.verification_status} onChange={() => undefined} className={inputClassName}>
                            {DOMAIN_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </label>
                      </form>

                      <div className="flex gap-3">
                        <button
                          type="submit"
                          form={statusFormId}
                          disabled={isPending && pendingAction === `status:${domain.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
                        >
                          {isPending && pendingAction === `status:${domain.id}` ? 'Saving...' : 'Save status'}
                        </button>

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
                        <button
                          type="submit"
                          form={removeFormId}
                          disabled={isPending && pendingAction === `remove:${domain.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-rose-500/40 px-4 py-3 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
                        >
                          {isPending && pendingAction === `remove:${domain.id}` ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Install safety</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Verified production domains control where the public widget should initialize. Pending or failed entries need follow-up before rollout.</p>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-300">
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Configured hostnames: {state.domains.length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Verified hostnames: {state.domains.filter((domain) => domain.verification_status === 'verified').length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Local development: {allowLocalhost ? 'localhost is currently allowed.' : 'localhost protection is disabled in settings_json.'}</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Status guidance</h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-300">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">Pending</span><p className="mt-2 text-zinc-400">Use while a hostname is being prepared but should not yet be treated as production-safe.</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">Verified</span><p className="mt-2 text-zinc-400">Safe state for live installs. This is the target before sharing the snippet broadly.</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">Failed or disabled</span><p className="mt-2 text-zinc-400">Use when a hostname should stop being trusted or the validation/setup is incomplete.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
