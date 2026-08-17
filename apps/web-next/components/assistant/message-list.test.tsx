import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageList } from './message-list';
import { AssistantLocaleProvider } from './locale-provider';
import type { DisplayMessage } from './use-assistant-chat';

function renderMessages(messages: DisplayMessage[]) {
  return render(
    <AssistantLocaleProvider initialLocale="ar">
      <MessageList messages={messages} />
    </AssistantLocaleProvider>,
  );
}

describe('MessageList link rendering', () => {
  it('isolates a bare URL/path link as LTR, since the label is the URL/path itself', () => {
    renderMessages([{ id: '1', role: 'assistant', content: 'راجع /pricing من فضلك.' }]);

    expect(screen.getByRole('link', { name: '/pricing' })).toHaveAttribute('dir', 'ltr');
  });

  it('does not force ltr on a link whose visible label is Arabic text, not the URL', () => {
    renderMessages([{ id: '1', role: 'assistant', content: 'راجع <a href="/pricing">التسعير</a> من فضلك.' }]);

    expect(screen.getByRole('link', { name: 'التسعير' })).not.toHaveAttribute('dir');
  });
});
