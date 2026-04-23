import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallPageContent } from '@/components/dashboard/install-page-content';

describe('InstallPageContent', () => {
  it('renders the real embed key and canonical snippet for the selected site', () => {
    render(
      <InstallPageContent
        site={{
          id: 'site_1',
          workspace_id: 'workspace_1',
          name: 'Main Site',
          embed_key: 'gc_live_real_embed',
          status: 'active',
          settings_json: {},
        }}
        domains={[]}
        allowLocalhost={true}
        canonicalSnippet={'<script>\nwindow.GrindctrlSupport = window.GrindctrlSupport || [];\n</script>'}
        cspSnippet={'<script data-gc-embed-key="gc_live_real_embed"></script>'}
      />,
    );

    expect(screen.getByText('gc_live_real_embed')).toBeInTheDocument();
    expect(screen.getByText(/window\.GrindctrlSupport = window\.GrindctrlSupport \|\| \[\]/)).toBeInTheDocument();
  });

  it('shows install domain safety state without changing the canonical snippet contract', () => {
    render(
      <InstallPageContent
        site={{
          id: 'site_1',
          workspace_id: 'workspace_1',
          name: 'Main Site',
          embed_key: 'gc_live_real_embed',
          status: 'active',
          settings_json: {},
        }}
        domains={[
          {
            id: 'domain_1',
            widget_site_id: 'site_1',
            domain: 'example.com',
            verification_status: 'verified',
          },
        ]}
        allowLocalhost={true}
        canonicalSnippet={'<script>\nwindow.GrindctrlSupport = window.GrindctrlSupport || [];\nwindow.GrindctrlSupport.push({ embedKey: \'gc_live_real_embed\' });\n</script>'}
        cspSnippet={'<script data-gc-embed-key="gc_live_real_embed"></script>'}
      />,
    );

    expect(screen.getByText('Domain safety')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText(/Localhost\/dev access: Enabled through settings_json security defaults\./)).toBeInTheDocument();
    expect(screen.getByText(/window\.GrindctrlSupport\.push\(\{ embedKey: 'gc_live_real_embed' \}\);/)).toBeInTheDocument();
  });
});
