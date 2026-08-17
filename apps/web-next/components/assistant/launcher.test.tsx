import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantLauncher } from './launcher';
import { createMockAssistantClient } from '@/lib/assistant/mock-client';

function renderLauncher() {
  return render(<AssistantLauncher client={createMockAssistantClient()} initialLocale="en" />);
}

describe('AssistantLauncher', () => {
  it('shows the closed-state chat mark and motion layer, not the close icon', () => {
    renderLauncher();

    expect(screen.getByRole('button', { name: 'Open assistant' })).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-chat-mark')).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-dna-svg')).toBeInTheDocument();
  });

  it('swaps to the close icon and drops the motion layer once opened', () => {
    renderLauncher();

    fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));

    expect(screen.getByRole('button', { name: 'Close assistant' })).toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-chat-mark')).not.toBeInTheDocument();
    expect(document.querySelector('.gc-launcher-dna-svg')).not.toBeInTheDocument();
  });
});
