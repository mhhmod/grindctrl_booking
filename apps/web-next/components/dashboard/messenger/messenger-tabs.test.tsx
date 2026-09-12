import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessengerTabs } from './messenger-tabs';

const { behaviour, conversations, overview } = vi.hoisted(() => ({ behaviour: vi.fn(), conversations: vi.fn(), overview: vi.fn() }));
vi.mock('./behaviour-editor', () => ({ BehaviourEditor: (props: unknown) => { behaviour(props); return <div>Behaviour panel</div>; } }));
vi.mock('./conversations-panel', () => ({ ConversationsPanel: (props: unknown) => { conversations(props); return <div>Conversation panel</div>; } }));
vi.mock('./publish-bar', () => ({ PublishBar: () => null }));
vi.mock('./overview', () => ({ MessengerOverview: (props: unknown) => { overview(props); return null; } }));
vi.mock('./appearance-editor', () => ({ AppearanceEditor: () => null }));
vi.mock('./ai-knowledge-editor', () => ({ AiKnowledgeEditor: () => null }));
vi.mock('./install-card', () => ({ InstallCard: () => null }));

describe('MessengerTabs saved replies', () => {
  it('passes the same merchant replies and actions to Behaviour and Conversations', () => {
    const cannedReplies = [{ id: 'r-1', title: 'Shipping', content: 'Ships fast', status: 'active' as const, sort_order: 0, updated_at: '' }];
    const props = {
      locale: 'en', initialTab: 'behaviour', siteId: 'site-1', domain: null,
      config: {}, cannedReplies, actions: {},
    } as React.ComponentProps<typeof MessengerTabs>;
    render(<MessengerTabs {...props} />);
    expect(behaviour).toHaveBeenLastCalledWith(expect.objectContaining({ cannedReplies, actions: props.actions, siteId: 'site-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conversations' }));
    expect(conversations).toHaveBeenLastCalledWith(expect.objectContaining({ cannedReplies, actions: props.actions, siteId: 'site-1' }));
  });
});


it.each([true, undefined])('threads revert availability and actions to Overview: %s', (canRevert) => {
  const props = {
    locale: 'en', initialTab: 'overview', siteId: 'site-1',
    config: { ai: { enabled: false } }, actions: { revertConfigAction: vi.fn() }, canRevert,
  } as unknown as React.ComponentProps<typeof MessengerTabs>;
  render(<MessengerTabs {...props} />);
  expect(overview).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 'site-1', canRevert: canRevert ?? false, actions: props.actions }));
});
