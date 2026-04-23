'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { IntentsState, IntentEditorValues } from '@/app/dashboard/intents/state';
import { getIntentActionLabel, getIntentTone, INTENT_ACTION_OPTIONS } from '@/lib/intents';
import type { WidgetIntent } from '@/lib/types';

const inputClassName = 'mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600';

function toEditorValues(intent: WidgetIntent): IntentEditorValues {
  return {
    label: intent.label,
    icon: intent.icon ?? 'chat',
    actionType: intent.action_type ?? 'send_message',
    messageText: intent.message_text ?? '',
    externalUrl: intent.external_url ?? '',
    sortOrder: String(intent.sort_order ?? 0),
  };
}

export function IntentsManager({
  initialState,
  initialValues,
  createIntentAction,
  updateIntentAction,
  deleteIntentAction,
  reorderIntentAction,
}: {
  initialState: IntentsState;
  initialValues: IntentEditorValues;
  createIntentAction: (formData: FormData) => Promise<IntentsState>;
  updateIntentAction: (formData: FormData) => Promise<IntentsState>;
  deleteIntentAction: (formData: FormData) => Promise<IntentsState>;
  reorderIntentAction: (formData: FormData) => Promise<IntentsState>;
}) {
  const [state, setState] = useState(initialState);
  const [values, setValues] = useState(initialValues);
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(initialState.fieldError);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setState(initialState);
    setValues(initialValues);
    setEditingIntentId(null);
    setInlineError(initialState.fieldError);
    setPendingAction(null);
  }, [initialState, initialValues]);

  const resetEditor = () => {
    setEditingIntentId(null);
    setValues(initialValues);
    setInlineError(null);
  };

  const submitIntent = () => {
    const formData = new FormData();
    if (editingIntentId) {
      formData.set('intentId', editingIntentId);
    }
    formData.set('label', values.label);
    formData.set('icon', values.icon);
    formData.set('actionType', values.actionType);
    formData.set('messageText', values.messageText);
    formData.set('externalUrl', values.externalUrl);
    formData.set('sortOrder', values.sortOrder);

    setPendingAction(editingIntentId ? 'update' : 'create');
    setInlineError(null);
    startTransition(async () => {
      const nextState = editingIntentId ? await updateIntentAction(formData) : await createIntentAction(formData);
      setState(nextState);
      setInlineError(nextState.fieldError);
      setPendingAction(null);

      if (nextState.messageType === 'success') {
        setEditingIntentId(null);
        setValues({ ...initialValues, sortOrder: String(nextState.intents.length) });
      }
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Widget intents</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Configure the quick actions that help visitors get routed to the right outcome faster.</p>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-medium text-zinc-300">Real backend contract</div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">{editingIntentId ? 'Edit intent' : 'Create intent'}</p>
              <p className="mt-1 text-sm text-zinc-500">Uses the current widget intent RPCs only. No widget-site config authority is involved.</p>
            </div>
            {editingIntentId ? (
              <button type="button" onClick={resetEditor} className="rounded-2xl border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500">
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-zinc-300">
              Label
              <input className={inputClassName + (inlineError ? ' border-rose-500/70 focus:border-rose-500' : '')} value={values.label} onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label className="block text-sm text-zinc-300">
              Icon
              <input className={inputClassName} value={values.icon} onChange={(event) => setValues((current) => ({ ...current, icon: event.target.value }))} />
            </label>
            <label className="block text-sm text-zinc-300">
              Action type
              <select className={inputClassName} value={values.actionType} onChange={(event) => setValues((current) => ({ ...current, actionType: event.target.value }))}>
                {INTENT_ACTION_OPTIONS.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {getIntentActionLabel(actionType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Sort order
              <input className={inputClassName} inputMode="numeric" value={values.sortOrder} onChange={(event) => setValues((current) => ({ ...current, sortOrder: event.target.value }))} />
            </label>
            <label className="block text-sm text-zinc-300 md:col-span-2">
              Message text
              <textarea className={inputClassName + ' min-h-28 resize-y'} value={values.messageText} onChange={(event) => setValues((current) => ({ ...current, messageText: event.target.value }))} />
            </label>
            <label className="block text-sm text-zinc-300 md:col-span-2">
              External URL
              <input className={inputClassName} value={values.externalUrl} onChange={(event) => setValues((current) => ({ ...current, externalUrl: event.target.value }))} />
            </label>
          </div>

          <div className="mt-4 min-h-6 text-sm" role="status" aria-live="polite">
            {isPending ? <span className="text-zinc-400">Saving intent changes...</span> : null}
            {!isPending && state.message ? <span className={state.messageType === 'error' ? 'text-rose-300' : 'text-emerald-300'}>{state.message}</span> : null}
          </div>

          {inlineError ? <p className="mt-3 text-sm text-rose-300">{inlineError}</p> : null}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={isPending && (pendingAction === 'create' || pendingAction === 'update')}
              onClick={submitIntent}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
            >
              {isPending && pendingAction === 'create' ? 'Creating...' : null}
              {isPending && pendingAction === 'update' ? 'Saving...' : null}
              {!isPending ? (editingIntentId ? 'Save intent' : 'Create intent') : null}
            </button>
          </div>
        </div>

        {state.intents.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-5 text-sm text-zinc-400">
            <p className="font-medium text-zinc-200">No intents configured yet.</p>
            <p className="mt-2 leading-6">Add your first quick action to help visitors reach the right workflow faster.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {state.intents.map((intent, index) => {
              const deleteFormId = `delete-intent-${intent.id}`;
              const moveUpDisabled = index === 0;
              const moveDownDisabled = index === state.intents.length - 1;

              return (
                <li key={intent.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-100">{intent.icon ?? 'chat'}</span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-100">{intent.label}</div>
                          <div className="mt-1 text-sm text-zinc-500">Priority {intent.sort_order ?? 0}</div>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getIntentTone(intent.action_type)}`}>
                          {getIntentActionLabel(intent.action_type)}
                        </span>
                      </div>

                      {intent.message_text ? <p className="mt-3 text-sm leading-6 text-zinc-400">{intent.message_text}</p> : null}
                      {intent.external_url ? <p className="mt-3 break-all text-sm text-sky-300">{intent.external_url}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIntentId(intent.id);
                          setValues(toEditorValues(intent));
                          setInlineError(null);
                        }}
                        className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={moveUpDisabled || (isPending && pendingAction === `reorder:${intent.id}:up`)}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set('intentId', intent.id);
                          formData.set('direction', 'up');
                          setPendingAction(`reorder:${intent.id}:up`);
                          startTransition(async () => {
                            const nextState = await reorderIntentAction(formData);
                            setState(nextState);
                            setInlineError(nextState.fieldError);
                            setPendingAction(null);
                          });
                        }}
                        className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
                      >
                        Up
                      </button>

                      <button
                        type="button"
                        disabled={moveDownDisabled || (isPending && pendingAction === `reorder:${intent.id}:down`)}
                        onClick={() => {
                          const formData = new FormData();
                          formData.set('intentId', intent.id);
                          formData.set('direction', 'down');
                          setPendingAction(`reorder:${intent.id}:down`);
                          startTransition(async () => {
                            const nextState = await reorderIntentAction(formData);
                            setState(nextState);
                            setInlineError(nextState.fieldError);
                            setPendingAction(null);
                          });
                        }}
                        className="rounded-2xl border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
                      >
                        Down
                      </button>

                      <form
                        id={deleteFormId}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const formData = new FormData(event.currentTarget);
                          setPendingAction(`delete:${intent.id}`);
                          startTransition(async () => {
                            const nextState = await deleteIntentAction(formData);
                            setState(nextState);
                            setInlineError(nextState.fieldError);
                            if (editingIntentId === intent.id) {
                              setEditingIntentId(null);
                              setValues(initialValues);
                            }
                            setPendingAction(null);
                          });
                        }}
                      >
                        <input type="hidden" name="intentId" value={intent.id} />
                      </form>
                      <button
                        type="submit"
                        form={deleteFormId}
                        disabled={isPending && pendingAction === `delete:${intent.id}`}
                        className="rounded-2xl border border-rose-500/40 px-4 py-3 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
                      >
                        {isPending && pendingAction === `delete:${intent.id}` ? 'Deleting...' : 'Delete'}
                      </button>
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
          <h2 className="text-lg font-semibold text-white">Intent summary</h2>
          <ul className="mt-4 grid gap-3 text-sm text-zinc-300">
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Configured intents: {state.intents.length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Message intents: {state.intents.filter((intent) => (intent.action_type ?? 'send_message') === 'send_message').length}</li>
            <li className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">Escalation intents: {state.intents.filter((intent) => intent.action_type === 'escalate').length}</li>
          </ul>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-white">Action guidance</h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-300">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">Send message</span><p className="mt-2 text-zinc-400">Use for quick prompts that should immediately seed the conversation.</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">External link</span><p className="mt-2 text-zinc-400">Use when the visitor should be sent to a booking page, help center, or external tool.</p></div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><span className="font-medium text-white">Escalate</span><p className="mt-2 text-zinc-400">Use for human handoff or higher-touch support routes handled by the current backend workflow.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
