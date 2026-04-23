import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/intents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/intents')>('@/lib/adapters/intents');
  return {
    ...actual,
    createIntent: vi.fn(),
    deleteIntent: vi.fn(),
    listIntents: vi.fn(),
    updateIntent: vi.fn(),
  };
});

import { createIntentAction, deleteIntentAction, reorderIntentAction, updateIntentAction } from '@/app/dashboard/intents/actions';
import { createIntent, deleteIntent, listIntents, updateIntent } from '@/lib/adapters/intents';

describe('intent actions', () => {
  it('creates and updates intents through the existing adapter path', async () => {
    vi.mocked(createIntent).mockResolvedValue({ id: 'intent_1', widget_site_id: 'site_1', label: 'Talk to sales', action_type: 'send_message', sort_order: 0 });
    vi.mocked(updateIntent).mockResolvedValue({ id: 'intent_1', widget_site_id: 'site_1', label: 'Book a demo', action_type: 'external_link', sort_order: 2 });
    vi.mocked(listIntents)
      .mockResolvedValueOnce([{ id: 'intent_1', widget_site_id: 'site_1', label: 'Talk to sales', action_type: 'send_message', sort_order: 0 }])
      .mockResolvedValueOnce([{ id: 'intent_1', widget_site_id: 'site_1', label: 'Book a demo', action_type: 'external_link', sort_order: 2 }]);

    const createForm = new FormData();
    createForm.set('label', 'Talk to sales');
    createForm.set('icon', 'headset');
    createForm.set('actionType', 'send_message');
    createForm.set('messageText', 'Talk to sales');
    createForm.set('externalUrl', '');
    createForm.set('sortOrder', '0');

    const createResult = await createIntentAction({ clerkUserId: 'user_123', siteId: 'site_1' }, createForm);
    expect(createIntent).toHaveBeenCalledWith('user_123', 'site_1', expect.objectContaining({ label: 'Talk to sales', actionType: 'send_message' }));
    expect(createResult.messageType).toBe('success');

    const updateForm = new FormData();
    updateForm.set('intentId', 'intent_1');
    updateForm.set('label', 'Book a demo');
    updateForm.set('icon', 'event');
    updateForm.set('actionType', 'external_link');
    updateForm.set('messageText', '');
    updateForm.set('externalUrl', 'https://example.com/demo');
    updateForm.set('sortOrder', '2');

    const updateResult = await updateIntentAction({ clerkUserId: 'user_123', siteId: 'site_1' }, updateForm);
    expect(updateIntent).toHaveBeenCalledWith('user_123', 'intent_1', expect.objectContaining({ label: 'Book a demo', actionType: 'external_link', sortOrder: 2 }));
    expect(updateResult.messageType).toBe('success');
  });

  it('deletes and reorders intents through the existing adapter contract', async () => {
    vi.mocked(deleteIntent).mockResolvedValue(true);
    vi.mocked(listIntents)
      .mockResolvedValueOnce([
        { id: 'intent_1', widget_site_id: 'site_1', label: 'First', action_type: 'send_message', sort_order: 0 },
        { id: 'intent_2', widget_site_id: 'site_1', label: 'Second', action_type: 'send_message', sort_order: 1 },
      ])
      .mockResolvedValueOnce([
        { id: 'intent_2', widget_site_id: 'site_1', label: 'Second', action_type: 'send_message', sort_order: 0 },
        { id: 'intent_1', widget_site_id: 'site_1', label: 'First', action_type: 'send_message', sort_order: 1 },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(updateIntent).mockResolvedValue({ id: 'intent_1', widget_site_id: 'site_1', label: 'First', action_type: 'send_message', sort_order: 1 });

    const reorderForm = new FormData();
    reorderForm.set('intentId', 'intent_1');
    reorderForm.set('direction', 'down');

    vi.mocked(updateIntent).mockClear();
    const reorderResult = await reorderIntentAction({ clerkUserId: 'user_123', siteId: 'site_1' }, reorderForm);
    expect(updateIntent).toHaveBeenCalledTimes(2);
    expect(reorderResult.messageType).toBe('success');

    const deleteForm = new FormData();
    deleteForm.set('intentId', 'intent_1');

    const deleteResult = await deleteIntentAction({ clerkUserId: 'user_123', siteId: 'site_1' }, deleteForm);
    expect(deleteIntent).toHaveBeenCalledWith('user_123', 'intent_1');
    expect(deleteResult.intents).toEqual([]);
  });

  it('returns inline validation errors for invalid payloads', async () => {
    vi.mocked(listIntents).mockResolvedValue([]);

    const form = new FormData();
    form.set('label', '');
    form.set('icon', 'chat');
    form.set('actionType', 'external_link');
    form.set('messageText', '');
    form.set('externalUrl', 'not-a-url');
    form.set('sortOrder', 'bad');

    const result = await createIntentAction({ clerkUserId: 'user_123', siteId: 'site_1' }, form);
    expect(result.messageType).toBe('error');
    expect(result.fieldError).toBe('Enter an intent label.');
  });
});
