import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from './message-list';
import { AssistantLocaleProvider } from './locale-provider';
import type { DisplayMessage } from './use-assistant-chat';

function renderMessages(messages: DisplayMessage[], onInternalNavigate?: () => void) {
  return render(
    <AssistantLocaleProvider initialLocale="ar">
      <MessageList messages={messages} onInternalNavigate={onInternalNavigate} />
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

describe('MessageList internal-link navigation', () => {
  it('calls onInternalNavigate when an internal reply link is clicked', () => {
    const onInternalNavigate = vi.fn();
    renderMessages([{ id: '1', role: 'assistant', content: 'راجع /pricing من فضلك.' }], onInternalNavigate);

    fireEvent.click(screen.getByRole('link', { name: '/pricing' }));

    expect(onInternalNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not call onInternalNavigate for an external link, which opens its own tab', () => {
    const onInternalNavigate = vi.fn();
    renderMessages(
      [{ id: '1', role: 'assistant', content: 'Book at https://calendar.app.google/abc123.' }],
      onInternalNavigate,
    );

    fireEvent.click(screen.getByRole('link', { name: 'https://calendar.app.google/abc123' }));

    expect(onInternalNavigate).not.toHaveBeenCalled();
  });
});
