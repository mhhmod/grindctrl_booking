import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformPillars } from '@/components/landing/platform-pillars';

describe('PlatformPillars', () => {
  it('renders capability maturity instead of presenting every pillar as equally complete', () => {
    render(<PlatformPillars items={[
      { title: 'Shopping experiences', body: 'Storefront capabilities.', status: 'Implemented in source' },
      { title: 'Reporting', body: 'Journey measurement.', status: 'Planned layer' },
    ]} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Implemented in source')).toBeInTheDocument();
    expect(screen.getByText('Planned layer')).toBeInTheDocument();
  });
});
