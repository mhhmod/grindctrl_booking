import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectedSystemMap } from '@/components/landing/connected-system-map';

describe('ConnectedSystemMap', () => {
  it('keeps every operating lane explicit', () => {
    render(<ConnectedSystemMap columns={['Shopper', 'GrindCTRL', 'Business system']} rows={[
      { shopper: 'Tries a product', grindctrl: 'Try-on generated', business: 'Interest recorded' },
      { shopper: 'Places an order', grindctrl: 'Outcome captured', business: 'Reporting can update' },
    ]} />);

    expect(screen.getAllByText('Shopper')).toHaveLength(3);
    expect(screen.getAllByText('GrindCTRL')).toHaveLength(3);
    expect(screen.getAllByText('Business system')).toHaveLength(3);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Try-on generated')).toBeInTheDocument();
    expect(screen.getByText('Reporting can update')).toBeInTheDocument();
  });
});
