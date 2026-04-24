import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallPageContent } from '@/components/dashboard/install-page-content';

const baseProps = {
  site: {
    id: 'site_1',
    workspace_id: 'workspace_1',
    name: 'Main Site',
    embed_key: 'gc_live_real_embed',
    status: 'active',
    settings_json: {},
  },
  allowLocalhost: true,
  canonicalSnippet: '<script>\nwindow.GrindctrlSupport = window.GrindctrlSupport || [];\nwindow.GrindctrlSupport.push({ embedKey: \'gc_live_real_embed\' });\n</script>',
  cspSnippet: '<script data-gc-embed-key="gc_live_real_embed"></script>',
  widgetEventsWindow: '7d',
  widgetEventsWindowLinks: {
    '24h': '/dashboard/install?window=24h',
    '7d': '/dashboard/install?window=7d',
    '30d': '/dashboard/install?window=30d',
  },
  widgetEventsState: {
    status: 'success',
    bundle: {
      timeseries: [],
      breakdown: [],
      funnel: null,
    },
    message: null,
  },
} as const;

describe('InstallPageContent', () => {
  it('renders the real embed key and canonical snippet for the selected site', () => {
    render(
      <InstallPageContent
        {...baseProps}
        domains={[]}
        verificationState={{ status: 'success', verification: null, message: null }}
        canonicalSnippet={'<script>\nwindow.GrindctrlSupport = window.GrindctrlSupport || [];\n</script>'}
      />,
    );

    expect(screen.getByText('gc_live_real_embed')).toBeInTheDocument();
    expect(screen.getByText(/window\.GrindctrlSupport = window\.GrindctrlSupport \|\| \[\]/)).toBeInTheDocument();
  });

  it('shows install domain safety state without changing the canonical snippet contract', () => {
    const currentHeartbeat = new Date().toISOString();

    render(
      <InstallPageContent
        {...baseProps}
        domains={[
          {
            id: 'domain_1',
            widget_site_id: 'site_1',
            domain: 'example.com',
            verification_status: 'verified',
          },
        ]}
        verificationState={{
          status: 'success',
          verification: {
            last_heartbeat_at: currentHeartbeat,
            last_seen_origin: 'https://example.com',
            last_seen_domain: 'example.com',
          },
          message: null,
        }}
      />,
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Domain safety')).toBeInTheDocument();
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0);
    expect(screen.getByText(/Last seen on example\.com, which is already verified for this site\./)).toBeInTheDocument();
    expect(screen.getByText(/Localhost\/dev access: Enabled through settings_json security defaults\./)).toBeInTheDocument();
    expect(screen.getByText(/window\.GrindctrlSupport\.push\(\{ embedKey: 'gc_live_real_embed' \}\);/)).toBeInTheDocument();
  });

  it('renders stale and domain warning states when the last seen domain is unsafe', () => {
    render(
      <InstallPageContent
        {...baseProps}
        domains={[
          {
            id: 'domain_1',
            widget_site_id: 'site_1',
            domain: 'verified.example.com',
            verification_status: 'verified',
          },
        ]}
        verificationState={{
          status: 'success',
          verification: {
            last_heartbeat_at: '2026-04-20T09:00:00.000Z',
            last_seen_origin: 'https://rogue.example.net',
            last_seen_domain: 'rogue.example.net',
          },
          message: null,
        }}
      />,
    );

    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText(/Last seen on rogue\.example\.net, which is not in the current allowed domain list\./)).toBeInTheDocument();
  });
});
