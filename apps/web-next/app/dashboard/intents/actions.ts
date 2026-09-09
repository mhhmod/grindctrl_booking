'use server';

import type { IntentEditorValues, IntentsState } from '@/app/dashboard/intents/state';
import { createIntent, deleteIntent, listIntents, updateIntent } from '@/lib/adapters/intents';
import { authorizeDashboardAction } from '@/lib/dashboard/action-authorization';
import { INTENT_ACTION_OPTIONS } from '@/lib/intents';

function getIntentValuesFromFormData(formData: FormData): IntentEditorValues {
  return {
    label: String(formData.get('label') ?? '').trim(),
    icon: String(formData.get('icon') ?? 'chat').trim() || 'chat',
    actionType: String(formData.get('actionType') ?? 'send_message').trim(),
    messageText: String(formData.get('messageText') ?? '').trim(),
    externalUrl: String(formData.get('externalUrl') ?? '').trim(),
    sortOrder: String(formData.get('sortOrder') ?? '0').trim(),
  };
}

function validateIntentValues(values: IntentEditorValues) {
  if (!values.label) return 'Enter an intent label.';
  if (!INTENT_ACTION_OPTIONS.includes(values.actionType as (typeof INTENT_ACTION_OPTIONS)[number])) {
    return 'Choose a valid intent action type.';
  }
  if (values.actionType === 'send_message' && !values.messageText) {
    return 'Send message intents need message text.';
  }
  if (values.actionType === 'external_link') {
    if (!values.externalUrl) return 'External link intents need a URL.';
    try {
      new URL(values.externalUrl);
    } catch {
      return 'Enter a valid external URL.';
    }
  }
  if (Number.isNaN(Number(values.sortOrder))) {
    return 'Sort order must be a number.';
  }
  return null;
}

async function buildSuccessState(clerkUserId: string, siteId: string, message: string): Promise<IntentsState> {
  return {
    intents: await listIntents(clerkUserId, siteId),
    message,
    messageType: 'success',
    fieldError: null,
  };
}

async function buildErrorState(clerkUserId: string, siteId: string, message: string, fieldError?: string | null): Promise<IntentsState> {
  return {
    intents: await listIntents(clerkUserId, siteId).catch(() => []),
    message,
    messageType: 'error',
    fieldError: fieldError ?? null,
  };
}

export async function createIntentAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<IntentsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { intents: [], message: authorizationError, messageType: 'error', fieldError: null };
  const values = getIntentValuesFromFormData(formData);
  const error = validateIntentValues(values);

  if (error) {
    return buildErrorState(context.clerkUserId, context.siteId, error, error);
  }

  try {
    await createIntent(context.clerkUserId, context.siteId, {
      label: values.label,
      icon: values.icon,
      actionType: values.actionType,
      messageText: values.actionType === 'send_message' ? values.messageText : null,
      externalUrl: values.actionType === 'external_link' ? values.externalUrl : null,
      sortOrder: Number(values.sortOrder),
    });
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Intent created.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to create intent. Please refresh before trying again.');
  }
}

export async function updateIntentAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<IntentsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { intents: [], message: authorizationError, messageType: 'error', fieldError: null };
  const intentId = String(formData.get('intentId') ?? '');
  const values = getIntentValuesFromFormData(formData);
  const error = !intentId ? 'Choose an intent to update.' : validateIntentValues(values);

  if (error) {
    return buildErrorState(context.clerkUserId, context.siteId, error, error);
  }

  try {
    const intents = await listIntents(context.clerkUserId, context.siteId);
    if (!intents.some((intent) => intent.id === intentId && intent.widget_site_id === context.siteId)) {
      return { intents, message: 'Choose an intent belonging to this site.', messageType: 'error', fieldError: null };
    }
    await updateIntent(context.clerkUserId, intentId, {
      label: values.label,
      icon: values.icon,
      actionType: values.actionType,
      messageText: values.actionType === 'send_message' ? values.messageText : '',
      externalUrl: values.actionType === 'external_link' ? values.externalUrl : '',
      sortOrder: Number(values.sortOrder),
    });
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Intent updated.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to update intent. Please refresh before trying again.');
  }
}

export async function deleteIntentAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<IntentsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { intents: [], message: authorizationError, messageType: 'error', fieldError: null };
  const intentId = String(formData.get('intentId') ?? '');

  if (!intentId) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose an intent to delete.');
  }

  try {
    const intents = await listIntents(context.clerkUserId, context.siteId);
    if (!intents.some((intent) => intent.id === intentId && intent.widget_site_id === context.siteId)) {
      return { intents, message: 'Choose an intent belonging to this site.', messageType: 'error', fieldError: null };
    }
    await deleteIntent(context.clerkUserId, intentId);
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Intent deleted.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to delete intent. Please refresh before trying again.');
  }
}

export async function reorderIntentAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<IntentsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { intents: [], message: authorizationError, messageType: 'error', fieldError: null };
  const intentId = String(formData.get('intentId') ?? '');
  const direction = String(formData.get('direction') ?? '');
  let intents;
  try {
    intents = await listIntents(context.clerkUserId, context.siteId);
  } catch {
    return { intents: [], message: 'Unable to load intents. Please try again shortly.', messageType: 'error', fieldError: null };
  }
  const index = intents.findIndex((intent) => intent.id === intentId);

  if (!intentId || !['up', 'down'].includes(direction) || index === -1) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose a valid reorder action.');
  }

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= intents.length) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Intent cannot move any further.');
  }

  const current = intents[index];
  const target = intents[swapIndex];

  try {
    await updateIntent(context.clerkUserId, current.id, { sortOrder: Number(target.sort_order ?? swapIndex) });
    await updateIntent(context.clerkUserId, target.id, { sortOrder: Number(current.sort_order ?? index) });
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Intent order updated.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to reorder intents. Please refresh before trying again.');
  }
}
