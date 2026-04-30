import type { WidgetIntent } from '@/lib/types';
import { getNextIntentSortOrder } from '@/lib/intents';

export interface IntentEditorValues {
  label: string;
  icon: string;
  actionType: string;
  messageText: string;
  externalUrl: string;
  sortOrder: string;
}

export interface IntentsState {
  intents: WidgetIntent[];
  message: string | null;
  messageType: 'success' | 'error' | null;
  fieldError: string | null;
}

function getDefaultIntentValues(sortOrder: number): IntentEditorValues {
  return {
    label: '',
    icon: 'chat',
    actionType: 'send_message',
    messageText: '',
    externalUrl: '',
    sortOrder: String(sortOrder),
  };
}

export function getInitialIntentsState(intents: WidgetIntent[]): IntentsState {
  return {
    intents,
    message: null,
    messageType: null,
    fieldError: null,
  };
}

export function getInitialIntentEditorValues(intents: WidgetIntent[]) {
  return getDefaultIntentValues(getNextIntentSortOrder(intents));
}
