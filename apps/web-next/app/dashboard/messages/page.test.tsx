import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardMessagesPage from '@/app/dashboard/messages/page';

describe('DashboardMessagesPage', () => {
  it('renders messages preview route with selected conversation', async () => {
    const result = await DashboardMessagesPage({ searchParams: Promise.resolve({ conversation: 'conv_web_001' }) });
    render(result);

    expect(screen.getByText(/^messages$/i)).toBeInTheDocument();
    expect(screen.getByText(/selected conversation preview/i)).toBeInTheDocument();
    expect(screen.getAllByText(/can you setup support automation/i).length).toBeGreaterThan(0);
  });
});
