import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyProofTabs } from '@/components/landing/journey-proof-tabs';

describe('JourneyProofTabs', () => {
  it('opens one journey explanation at a time using accessible tabs', () => {
    render(
      <JourneyProofTabs
        dir="ltr"
        label="Illustrative downstream journey"
        stages={[
          { title: 'Try-on', body: 'The shopper generates a preview.' },
          { title: 'Intent', body: 'Product interest becomes a usable signal.' },
        ]}
      />,
    );

    const intentTab = screen.getByRole('tab', { name: /intent/i });
    expect(screen.getByRole('tab', { name: /try-on/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.mouseDown(intentTab, { button: 0, ctrlKey: false });

    expect(intentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Product interest becomes a usable signal.');
  });

  it('labels the tab list and follows RTL arrow-key order', async () => {
    render(
      <JourneyProofTabs
        dir="rtl"
        label="رحلة توضيحية لاحقة"
        stages={[
          { title: 'التجربة', body: 'ينشئ المتسوق معاينة.' },
          { title: 'النية', body: 'يتحول الاهتمام إلى إشارة مفيدة.' },
          { title: 'العميل', body: 'يُحفظ السياق بموافقة العميل.' },
        ]}
      />,
    );

    const tabList = screen.getByRole('tablist', { name: 'رحلة توضيحية لاحقة' });
    const firstTab = screen.getByRole('tab', { name: /التجربة/ });
    const secondTab = screen.getByRole('tab', { name: /النية/ });

    expect(tabList.closest('[data-slot="tabs"]')).toHaveAttribute('dir', 'rtl');
    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'ArrowLeft' });

    await waitFor(() => expect(secondTab).toHaveFocus());
    expect(secondTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('يتحول الاهتمام إلى إشارة مفيدة.');
  });
});
