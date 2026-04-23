import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IntentsState } from '@/app/dashboard/intents/state';
import { IntentsManager } from '@/components/dashboard/intents-manager';

const initialState: IntentsState = {
  intents: [
    { id: 'intent_1', widget_site_id: 'site_1', label: 'Talk to sales', icon: 'chat', action_type: 'send_message', message_text: 'Talk to sales', sort_order: 0 },
  ],
  message: null,
  messageType: null,
  fieldError: null,
};

const initialValues = {
  label: '',
  icon: 'chat',
  actionType: 'send_message',
  messageText: '',
  externalUrl: '',
  sortOrder: '1',
};

describe('IntentsManager', () => {
  it('shows empty and validation states, then supports create flow', async () => {
    const createIntentAction = vi.fn()
      .mockResolvedValueOnce({
        ...initialState,
        message: 'Enter an intent label.',
        messageType: 'error',
        fieldError: 'Enter an intent label.',
      })
      .mockResolvedValueOnce({
        ...initialState,
        intents: [...initialState.intents, { id: 'intent_2', widget_site_id: 'site_1', label: 'Book demo', icon: 'event', action_type: 'external_link', external_url: 'https://example.com/demo', sort_order: 1 }],
        message: 'Intent created.',
        messageType: 'success',
        fieldError: null,
      });

    const { rerender } = render(
      <IntentsManager
        initialState={{ ...initialState, intents: [] }}
        initialValues={initialValues}
        createIntentAction={createIntentAction}
        updateIntentAction={vi.fn().mockResolvedValue(initialState)}
        deleteIntentAction={vi.fn().mockResolvedValue(initialState)}
        reorderIntentAction={vi.fn().mockResolvedValue(initialState)}
      />,
    );

    expect(screen.getByText('No intents configured yet.')).toBeInTheDocument();

    rerender(
      <IntentsManager
        initialState={initialState}
        initialValues={initialValues}
        createIntentAction={createIntentAction}
        updateIntentAction={vi.fn().mockResolvedValue(initialState)}
        deleteIntentAction={vi.fn().mockResolvedValue(initialState)}
        reorderIntentAction={vi.fn().mockResolvedValue(initialState)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create intent' }));
    await waitFor(() => expect(screen.getByText('Enter an intent label.')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Book demo' } });
    fireEvent.change(screen.getByLabelText('Action type'), { target: { value: 'external_link' } });
    fireEvent.change(screen.getByLabelText('External URL'), { target: { value: 'https://example.com/demo' } });
    fireEvent.change(screen.getByLabelText('Sort order'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create intent' }));

    await waitFor(() => expect(createIntentAction).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Intent created.')).toBeInTheDocument());
    expect(screen.getByText('Book demo')).toBeInTheDocument();
  });

  it('supports edit, delete, reorder, and error feedback', async () => {
    const updateIntentAction = vi.fn().mockResolvedValue({
      ...initialState,
      intents: [
        { ...initialState.intents[0], label: 'Updated intent', sort_order: 0 },
        { id: 'intent_2', widget_site_id: 'site_1', label: 'Second', icon: 'chat', action_type: 'send_message', message_text: 'Second', sort_order: 1 },
      ],
      message: 'Intent updated.',
      messageType: 'success',
      fieldError: null,
    });
    const deleteIntentAction = vi.fn().mockResolvedValue({ intents: [], message: 'Intent deleted.', messageType: 'success', fieldError: null });
    const reorderIntentAction = vi.fn().mockResolvedValue({
      ...initialState,
      intents: [
        { id: 'intent_2', widget_site_id: 'site_1', label: 'Second', icon: 'chat', action_type: 'send_message', message_text: 'Second', sort_order: 0 },
        { ...initialState.intents[0], sort_order: 1 },
      ],
      message: 'Intent order updated.',
      messageType: 'success',
      fieldError: null,
    });

    let resolveError: ((value: IntentsState) => void) | undefined;
    const createIntentAction = vi.fn(
      () =>
        new Promise<IntentsState>((resolve) => {
          resolveError = resolve;
        }),
    );

    render(
      <IntentsManager
        initialState={{
          ...initialState,
          intents: [
            initialState.intents[0],
            { id: 'intent_2', widget_site_id: 'site_1', label: 'Second', icon: 'chat', action_type: 'send_message', message_text: 'Second', sort_order: 1 },
          ],
        }}
        initialValues={initialValues}
        createIntentAction={createIntentAction}
        updateIntentAction={updateIntentAction}
        deleteIntentAction={deleteIntentAction}
        reorderIntentAction={reorderIntentAction}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Updated intent' } });
    fireEvent.change(screen.getByLabelText('Sort order'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save intent' }));
    await waitFor(() => expect(screen.getByText('Intent updated.')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Down' })[0]);
    await waitFor(() => expect(screen.getByText('Intent order updated.')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => expect(screen.getByText('Intent deleted.')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Broken intent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create intent' }));
    expect(await screen.findByText('Saving intent changes...')).toBeInTheDocument();

    await act(async () => {
      resolveError?.({ intents: [], message: 'dashboard_create_intent failed', messageType: 'error', fieldError: null });
    });

    await waitFor(() => expect(screen.getByText('dashboard_create_intent failed')).toBeInTheDocument());
  });
});
