import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardConversationsPage from '@/app/dashboard/conversations/page';

describe('DashboardConversationsPage', () => {
  it('renders unified inbox preview and channel badges', async () => {
    const result = await DashboardConversationsPage({ searchParams: Promise.resolve({ conversation: 'conv_wa_002' }) });
    render(result);

    expect(screen.getByText(/preview inbox/i)).toBeInTheDocument();
    expect(screen.getAllByText('Website').length).toBeGreaterThan(0);
    expect(screen.getAllByText('WhatsApp').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /handoff \(preview only\)/i })).toBeDisabled();
  });
});
