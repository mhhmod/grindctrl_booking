import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardAnalyticsPage from '@/app/dashboard/analytics/page';

describe('DashboardAnalyticsPage', () => {
  it('renders analytics preview sections', () => {
    render(<DashboardAnalyticsPage />);

    expect(screen.getByText(/trial funnel/i)).toBeInTheDocument();
    expect(screen.getByText(/operations metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/channel breakdown/i)).toBeInTheDocument();
    expect(screen.getByText('Landing visit')).toBeInTheDocument();
  });
});
