'use client';

import React from 'react';
import { useEffect, useState, useTransition } from 'react';
import type { IntentsState, IntentEditorValues } from '@/app/dashboard/intents/state';
import { getIntentActionLabel, getIntentTone, INTENT_ACTION_OPTIONS } from '@/lib/intents';
import type { WidgetIntent } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClassName = 'w-full min-h-28 resize-y rounded-2xl border border-input bg-input/30 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

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
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Widget intents</CardTitle>
            <CardDescription>Configure the quick actions that help visitors get routed to the right outcome faster.</CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">Real backend contract</Badge>
        </CardHeader>

        <CardContent>
          <div className="rounded-lg border bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{editingIntentId ? 'Edit intent' : 'Create intent'}</p>
                <p className="mt-1 text-sm text-muted-foreground">Uses the current widget intent RPCs only. No widget-site config authority is involved.</p>
              </div>
              {editingIntentId ? (
                <Button type="button" variant="outline" size="sm" onClick={resetEditor}>
                  Cancel edit
                </Button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intent-label">Label</Label>
                <Input
                  id="intent-label"
                  aria-invalid={inlineError ? 'true' : 'false'}
                  aria-describedby={inlineError ? 'intent-inline-error' : undefined}
                  value={values.label}
                  onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intent-icon">Icon</Label>
                <Input id="intent-icon" value={values.icon} onChange={(event) => setValues((current) => ({ ...current, icon: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intent-action-type">Action type</Label>
                <select id="intent-action-type" className={selectClassName} value={values.actionType} onChange={(event) => setValues((current) => ({ ...current, actionType: event.target.value }))}>
                  {INTENT_ACTION_OPTIONS.map((actionType) => (
                    <option key={actionType} value={actionType}>
                      {getIntentActionLabel(actionType)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intent-sort-order">Sort order</Label>
                <Input id="intent-sort-order" inputMode="numeric" value={values.sortOrder} onChange={(event) => setValues((current) => ({ ...current, sortOrder: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="intent-message-text">Message text</Label>
                <textarea id="intent-message-text" className={textareaClassName} value={values.messageText} onChange={(event) => setValues((current) => ({ ...current, messageText: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="intent-external-url">External URL</Label>
                <Input id="intent-external-url" value={values.externalUrl} onChange={(event) => setValues((current) => ({ ...current, externalUrl: event.target.value }))} />
              </div>
            </div>

            <div className="mt-4 min-h-6 text-sm" role="status" aria-live="polite">
              {isPending ? <span className="text-muted-foreground">Saving intent changes...</span> : null}
              {!isPending && state.message ? <span className={state.messageType === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>{state.message}</span> : null}
            </div>

            {inlineError ? <p id="intent-inline-error" className="mt-3 text-sm text-destructive">{inlineError}</p> : null}

            <div className="mt-4 flex justify-end">
              <Button
                disabled={isPending && (pendingAction === 'create' || pendingAction === 'update')}
                onClick={submitIntent}
              >
                {isPending && pendingAction === 'create' ? 'Creating...' : null}
                {isPending && pendingAction === 'update' ? 'Saving...' : null}
                {!isPending ? (editingIntentId ? 'Save intent' : 'Create intent') : null}
              </Button>
            </div>
          </div>

          {state.intents.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No intents configured yet.</p>
              <p className="mt-2 leading-6">Add your first quick action to help visitors reach the right workflow faster.</p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {state.intents.map((intent, index) => {
                const deleteFormId = `delete-intent-${intent.id}`;
                const moveUpDisabled = index === 0;
                const moveDownDisabled = index === state.intents.length - 1;

                return (
                  <li key={intent.id} className="rounded-lg border bg-muted/10 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">{intent.icon ?? 'chat'}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{intent.label}</div>
                            <div className="mt-1 text-sm text-muted-foreground">Priority {intent.sort_order ?? 0}</div>
                          </div>
                          <Badge variant="outline" className={getIntentTone(intent.action_type)}>
                            {getIntentActionLabel(intent.action_type)}
                          </Badge>
                        </div>

                        {intent.message_text ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{intent.message_text}</p> : null}
                        {intent.external_url ? <p className="mt-3 break-all text-sm text-primary" dir="ltr">{intent.external_url}</p> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingIntentId(intent.id);
                            setValues(toEditorValues(intent));
                            setInlineError(null);
                          }}
                        >
                          Edit
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Move ${intent.label} up`}
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
                        >
                          Up
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Move ${intent.label} down`}
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
                        >
                          Down
                        </Button>

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
                        <Button
                          type="submit"
                          form={deleteFormId}
                          variant="destructive"
                          size="sm"
                          disabled={isPending && pendingAction === `delete:${intent.id}`}
                          onClick={(event) => {
                            if (!window.confirm(`Delete intent \"${intent.label}\"?`)) {
                              event.preventDefault();
                            }
                          }}
                        >
                          {isPending && pendingAction === `delete:${intent.id}` ? 'Deleting...' : 'Delete'}
                        </Button>
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
            <CardTitle>Intent summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              <li className="rounded-lg border bg-muted/10 p-4">Configured intents: {state.intents.length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Message intents: {state.intents.filter((intent) => (intent.action_type ?? 'send_message') === 'send_message').length}</li>
              <li className="rounded-lg border bg-muted/10 p-4">Escalation intents: {state.intents.filter((intent) => intent.action_type === 'escalate').length}</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">Send message</span><p className="mt-2 text-muted-foreground">Use for quick prompts that should immediately seed the conversation.</p></div>
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">External link</span><p className="mt-2 text-muted-foreground">Use when the visitor should be sent to a booking page, help center, or external tool.</p></div>
              <div className="rounded-lg border bg-muted/10 p-4"><span className="font-medium text-foreground">Escalate</span><p className="mt-2 text-muted-foreground">Use for human handoff or higher-touch support routes handled by the current backend workflow.</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
