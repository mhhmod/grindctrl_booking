import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WidgetInteractionCharts } from '@/components/dashboard/widget-interaction-charts';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}

describe('WidgetInteractionCharts', () => {
  it('renders loading state when analytics are pending', () => {
    render(<WidgetInteractionCharts status="loading" timeseries={[]} breakdown={[]} funnel={null} />);

    expect(screen.getByLabelText('Loading widget interaction charts')).toBeInTheDocument();
  });

  it('renders empty state when no timeseries data is available', () => {
    render(<WidgetInteractionCharts timeseries={[]} breakdown={[]} funnel={null} />);

    expect(screen.getByText('No widget events yet')).toBeInTheDocument();
  });

  it('renders funnel values when analytics data is available', () => {
    render(
      <WidgetInteractionCharts
        timeseries={[
          {
            bucket_start: '2026-04-24T00:00:00.000Z',
            heartbeat_count: 2,
            widget_open_count: 10,
            widget_close_count: 8,
            conversation_start_count: 6,
            message_sent_count: 20,
            intent_click_count: 5,
            lead_captured_count: 2,
            lead_capture_skipped_count: 1,
            escalation_trigger_count: 1,
            other_count: 0,
            total_count: 55,
          },
        ]}
        breakdown={[
          { event_name: 'widget_open', total_count: 10 },
          { event_name: 'message_sent', total_count: 20 },
        ]}
        funnel={{
          widget_open_count: 10,
          conversation_start_count: 6,
          message_sent_count: 20,
          lead_captured_count: 2,
          escalation_trigger_count: 1,
          open_to_conversation_rate: 60,
          conversation_to_message_rate: 333.33,
          message_to_lead_rate: 10,
        }}
      />,
    );

    expect(screen.getByText('Funnel summary')).toBeInTheDocument();
    expect(screen.getByText('Widget opens')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('60.00%')).toBeInTheDocument();
  });
});
