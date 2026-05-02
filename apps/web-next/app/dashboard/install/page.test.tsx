import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardInstallPage from '@/app/dashboard/install/page';

describe('DashboardInstallPage', () => {
  it('renders snippet with placeholder key and copy button', () => {
    render(<DashboardInstallPage />);

    expect(screen.getByText(/widget embed and install center/i)).toBeInTheDocument();
    expect(screen.getAllByText(/gc_your_site_key_here/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /copy snippet/i })).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/grindctrl.cloud\/scripts\/grindctrl-support.js/i)).toBeInTheDocument();
  });
});
