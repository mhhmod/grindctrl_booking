'use client';

import React from 'react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import type { IntentsState, IntentEditorValues } from '@/app/dashboard/intents/state';
import { getIntentActionLabel, getIntentTone, INTENT_ACTION_OPTIONS } from '@/lib/intents';
import type { WidgetIntent } from '@/lib/types';
import { INTENTS_PAGE_SIZE_OPTIONS, INTENTS_SORT_OPTIONS, type IntentsListQuery, resolveIntentsList } from '@/lib/dashboard/intents-list-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFormFeedback } from '@/components/dashboard/form-feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const selectClassName = 'h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const textareaClassName = 'w-full min-h-28 resize-y rounded-2xl border border-input bg-input/30 px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const INTENT_SORT_LABELS: Record<(typeof INTENTS_SORT_OPTIONS)[number], string> = {
  priority_asc: 'Priority (low to high)',
  priority_desc: 'Priority (high to low)',
  label_asc: 'Label (A-Z)',
  label_desc: 'Label (Z-A)',
};

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

function isIntentEditorValuesEqual(left: IntentEditorValues, right: IntentEditorValues) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getIntentEditorValidation(values: IntentEditorValues) {
  const label = values.label.trim();
  const isActionTypeValid = INTENT_ACTION_OPTIONS.includes(values.actionType as (typeof INTENT_ACTION_OPTIONS)[number]);
  const messageTextInvalid = values.actionType === 'send_message' && !values.messageText.trim();
  const sortOrderInvalid = Number.isNaN(Number(values.sortOrder.trim()));
  const externalUrlRequired = values.actionType === 'external_link';
  const externalUrl = values.externalUrl.trim();

  let externalUrlInvalid = false;
  let externalUrlMessage: string | null = null;

  if (externalUrlRequired) {
    if (!externalUrl) {
      externalUrlInvalid = true;
      externalUrlMessage = 'External link intents require a URL.';
    } else {
      try {
        const parsed = new URL(externalUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          externalUrlInvalid = true;
          externalUrlMessage = 'External URL must use http or https.';
        }
      } catch {
        externalUrlInvalid = true;
        externalUrlMessage = 'Enter a valid external URL.';
      }
    }
  }

  const invalidFields = {
    label: !label,
    actionType: !isActionTypeValid,
    messageText: messageTextInvalid,
    externalUrl: externalUrlInvalid,
    sortOrder: sortOrderInvalid,
  };

  if (!label) {
    return {
      message: 'Intent label is required.',
      invalidFields,
    };
  }

  if (!isActionTypeValid) {
    return {
      message: 'Choose a valid action type.',
      invalidFields,
    };
  }

  if (messageTextInvalid) {
    return {
      message: 'Send message intents require message text.',
      invalidFields,
    };
  }

  if (externalUrlMessage) {
    return {
      message: externalUrlMessage,
      invalidFields,
    };
  }

  if (sortOrderInvalid) {
    return {
      message: 'Sort order must be a number.',
      invalidFields,
    };
  }

  return {
    message: null,
    invalidFields,
  };
}

export function IntentsManager({
  initialState,
  initialValues,
  createIntentAction,
  updateIntentAction,
  deleteIntentAction,
  reorderIntentAction,
  selectedSiteId,
  listQuery,
}: {
  initialState: IntentsState;
  initialValues: IntentEditorValues;
  createIntentAction: (formData: FormData) => Promise<IntentsState>;
  updateIntentAction: (formData: FormData) => Promise<IntentsState>;
  deleteIntentAction: (formData: FormData) => Promise<IntentsState>;
  reorderIntentAction: (formData: FormData) => Promise<IntentsState>;
  selectedSiteId: string;
  listQuery: IntentsListQuery;
}) {
  return (
    <IntentsManagerInner
      key={JSON.stringify({ initialState, initialValues })}
      initialState={initialState}
      initialValues={initialValues}
      createIntentAction={createIntentAction}
      updateIntentAction={updateIntentAction}
      deleteIntentAction={deleteIntentAction}
      reorderIntentAction={reorderIntentAction}
      selectedSiteId={selectedSiteId}
      listQuery={listQuery}
    />
  );
}

function IntentsManagerInner({
  initialState,
  initialValues,
  createIntentAction,
  updateIntentAction,
  deleteIntentAction,
  reorderIntentAction,
  selectedSiteId,
  listQuery,
}: {
  initialState: IntentsState;
  initialValues: IntentEditorValues;
  createIntentAction: (formData: FormData) => Promise<IntentsState>;
  updateIntentAction: (formData: FormData) => Promise<IntentsState>;
  deleteIntentAction: (formData: FormData) => Promise<IntentsState>;
  reorderIntentAction: (formData: FormData) => Promise<IntentsState>;
  selectedSiteId: string;
  listQuery: IntentsListQuery;
}) {
  const [state, setState] = useState(initialState);
  const [values, setValues] = useState(initialValues);
  const [editingIntentId, setEditingIntentId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(initialState.fieldError);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolvedIntents = useMemo(() => resolveIntentsList(state.intents, listQuery), [state.intents, listQuery]);
  const editingIntent = editingIntentId ? state.intents.find((intent) => intent.id === editingIntentId) ?? null : null;
  const editingBaseline = editingIntent ? toEditorValues(editingIntent) : initialValues;
  const editorValidation = getIntentEditorValidation(values);
  const editorValidationMessage = editorValidation.message;
  const isEditorDirty = !isIntentEditorValuesEqual(values, editingBaseline);

  function buildIntentsHref(next: {
    q?: string;
    action?: IntentsListQuery['action'];
    sort?: IntentsListQuery['sort'];
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    params.set('site', selectedSiteId);

    const nextQuery = (next.q ?? listQuery.q).trim();
    const nextAction = next.action ?? listQuery.action;
    const nextSort = next.sort ?? listQuery.sort;
    const nextPage = next.page ?? resolvedIntents.page;
    const nextPageSize = next.pageSize ?? listQuery.pageSize;

    if (nextQuery) {
      params.set('q', nextQuery);
    }
    if (nextAction !== 'all') {
      params.set('action', nextAction);
    }
    if (nextSort !== 'priority_asc') {
      params.set('sort', nextSort);
    }
    if (nextPage > 1) {
      params.set('page', String(nextPage));
    }
    if (nextPageSize !== 10) {
      params.set('pageSize', String(nextPageSize));
    }

    const queryString = params.toString();
    return queryString ? `/dashboard/intents?${queryString}` : '/dashboard/intents';
  }

  const resetEditor = () => {
    setEditingIntentId(null);
    setValues(initialValues);
    setInlineError(null);
  };

  const submitIntent = () => {
    if (!isEditorDirty) {
      return;
    }

    if (editorValidationMessage) {
      setInlineError(editorValidationMessage);
      return;
    }

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
                  aria-invalid={editorValidation.invalidFields.label ? 'true' : 'false'}
                  aria-describedby={editorValidation.invalidFields.label ? 'intent-inline-error' : undefined}
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
                <select
                  id="intent-action-type"
                  className={selectClassName}
                  aria-invalid={editorValidation.invalidFields.actionType ? 'true' : 'false'}
                  aria-describedby={editorValidation.invalidFields.actionType ? 'intent-inline-error' : undefined}
                  value={values.actionType}
                  onChange={(event) => setValues((current) => ({ ...current, actionType: event.target.value }))}
                >
                  {INTENT_ACTION_OPTIONS.map((actionType) => (
                    <option key={actionType} value={actionType}>
                      {getIntentActionLabel(actionType)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intent-sort-order">Sort order</Label>
                <Input
                  id="intent-sort-order"
                  inputMode="numeric"
                  aria-invalid={editorValidation.invalidFields.sortOrder ? 'true' : 'false'}
                  aria-describedby={editorValidation.invalidFields.sortOrder ? 'intent-inline-error' : undefined}
                  value={values.sortOrder}
                  onChange={(event) => setValues((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="intent-message-text">Message text</Label>
                <textarea
                  id="intent-message-text"
                  className={textareaClassName}
                  aria-invalid={editorValidation.invalidFields.messageText ? 'true' : 'false'}
                  aria-describedby={editorValidation.invalidFields.messageText ? 'intent-inline-error' : undefined}
                  value={values.messageText}
                  onChange={(event) => setValues((current) => ({ ...current, messageText: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="intent-external-url">External URL</Label>
                <Input
                  id="intent-external-url"
                  aria-invalid={editorValidation.invalidFields.externalUrl ? 'true' : 'false'}
                  aria-describedby={editorValidation.invalidFields.externalUrl ? 'intent-inline-error' : undefined}
                  value={values.externalUrl}
                  onChange={(event) => setValues((current) => ({ ...current, externalUrl: event.target.value }))}
                />
              </div>
            </div>

            <DashboardFormFeedback
              className="mt-4"
              isPending={isPending}
              pendingMessage="Saving intent changes..."
              message={state.message}
              tone={state.messageType}
            />

            {inlineError ?? editorValidationMessage ? <p id="intent-inline-error" className="mt-3 text-sm text-destructive">{inlineError ?? editorValidationMessage}</p> : null}

            <div className="mt-4 flex justify-end">
              <Button
                disabled={(isPending && (pendingAction === 'create' || pendingAction === 'update')) || !isEditorDirty || Boolean(editorValidationMessage)}
                onClick={submitIntent}
              >
                {isPending && pendingAction === 'create' ? 'Creating...' : null}
                {isPending && pendingAction === 'update' ? 'Saving...' : null}
                {!isPending ? (editingIntentId ? 'Save intent' : 'Create intent') : null}
              </Button>
            </div>
          </div>

          <form method="get" action="/dashboard/intents" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_220px_120px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="intent-query">Search intents</Label>
              <Input id="intent-query" name="q" defaultValue={listQuery.q} placeholder="Find by label, action, message, or URL" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent-action-filter">Action</Label>
              <select id="intent-action-filter" name="action" className={selectClassName} defaultValue={listQuery.action}>
                <option value="all">All actions</option>
                {INTENT_ACTION_OPTIONS.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {getIntentActionLabel(actionType)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent-sort">Sort by</Label>
              <select id="intent-sort" name="sort" className={selectClassName} defaultValue={listQuery.sort}>
                {INTENTS_SORT_OPTIONS.map((sort) => (
                  <option key={sort} value={sort}>
                    {INTENT_SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent-page-size">Rows</Label>
              <select id="intent-page-size" name="pageSize" className={selectClassName} defaultValue={String(listQuery.pageSize)}>
                {INTENTS_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline">
                <Link href={buildIntentsHref({ q: '', action: 'all', sort: 'priority_asc', page: 1, pageSize: 10 })}>Clear</Link>
              </Button>
            </div>

            <input type="hidden" name="site" value={selectedSiteId} />
            <input type="hidden" name="page" value="1" />
          </form>

          {resolvedIntents.totalItems === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{state.intents.length === 0 ? 'No intents configured yet.' : 'No intents match the current filters.'}</p>
              <p className="mt-2 leading-6">{state.intents.length === 0 ? 'Add your first quick action to help visitors reach the right workflow faster.' : 'Try adjusting the search, action filter, or sorting.'}</p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3 border-b pb-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing <span className="font-medium text-foreground">{resolvedIntents.startIndex}-{resolvedIntents.endIndex}</span> of{' '}
                  <span className="font-medium text-foreground">{resolvedIntents.totalItems}</span> matched intents
                  {resolvedIntents.totalItems !== state.intents.length ? ` (${state.intents.length} total)` : ''}.
                </p>
                <p>
                  Page <span className="font-medium text-foreground">{resolvedIntents.page}</span> of{' '}
                  <span className="font-medium text-foreground">{resolvedIntents.totalPages}</span>
                </p>
              </div>

              <ul className="mt-4 grid gap-3">
              {resolvedIntents.items.map((intent, index) => {
                const deleteFormId = `delete-intent-${intent.id}`;
                const moveUpDisabled = index === 0 || resolvedIntents.page !== 1;
                const moveDownDisabled = index === resolvedIntents.items.length - 1 || resolvedIntents.page !== resolvedIntents.totalPages;

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

              <div className="mt-4 flex items-center justify-end gap-2">
                {resolvedIntents.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildIntentsHref({ page: resolvedIntents.page - 1 })}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Previous
                  </Button>
                )}

                {resolvedIntents.page < resolvedIntents.totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={buildIntentsHref({ page: resolvedIntents.page + 1 })}>Next</Link>
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
