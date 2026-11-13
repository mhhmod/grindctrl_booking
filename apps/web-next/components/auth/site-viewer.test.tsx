import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { isLoaded: false, isSignedIn: undefined as boolean | undefined },
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => state.auth }));

import { SiteViewerProvider, SiteViewerSync, useSiteViewer } from './site-viewer';

beforeEach(() => {
  state.auth = { isLoaded: false, isSignedIn: undefined };
  state.refresh.mockClear();
});

describe('SiteViewerSync', () => {
  it('does nothing while Clerk loads or when it agrees with the server', () => {
    const { rerender } = render(<SiteViewerSync signedIn />);
    state.auth = { isLoaded: true, isSignedIn: true };
    rerender(<SiteViewerSync signedIn />);
    expect(state.refresh).not.toHaveBeenCalled();
  });

  it('asks the server again once when the session changed after the page was drawn', () => {
    state.auth = { isLoaded: true, isSignedIn: false };
    const { rerender } = render(<SiteViewerSync signedIn />);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    // Same disagreement on the next render: no loop.
    rerender(<SiteViewerSync signedIn />);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    // The refreshed page agrees.
    rerender(<SiteViewerSync signedIn={false} />);
    expect(state.refresh).toHaveBeenCalledTimes(1);
    // Signed in again later, in this tab or another.
    state.auth = { isLoaded: true, isSignedIn: true };
    rerender(<SiteViewerSync signedIn={false} />);
    expect(state.refresh).toHaveBeenCalledTimes(2);
  });
});

describe('useSiteViewer', () => {
  function Probe() {
    const { viewer, clerk } = useSiteViewer();
    return <p>{`${viewer.signedIn}:${clerk}`}</p>;
  }

  it('is signed out without a provider (embeds, tests, no Clerk)', () => {
    expect(render(<Probe />).container).toHaveTextContent('false:false');
  });

  it('carries the server’s viewer', () => {
    const { container } = render(
      <SiteViewerProvider viewer={{ signedIn: true, initials: 'A', imageUrl: null }} clerk>
        <Probe />
      </SiteViewerProvider>,
    );
    expect(container).toHaveTextContent('true:true');
  });
});
