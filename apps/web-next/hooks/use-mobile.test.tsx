import * as React from 'react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from './use-mobile';

function Probe() {
  return <span>{useIsMobile() ? 'mobile' : 'desktop'}</span>;
}

function mockViewport(mobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useIsMobile', () => {
  it('hydrates a phone without a mismatch, then reports mobile', async () => {
    mockViewport(true);
    const container = document.createElement('div');
    container.innerHTML = renderToString(<Probe />);
    document.body.appendChild(container);
    expect(container.textContent).toBe('desktop');

    const onRecoverableError = vi.fn();
    await act(async () => {
      hydrateRoot(container, <Probe />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe('mobile');
  });

  it('reports desktop on wide viewports', async () => {
    mockViewport(false);
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = renderToString(<Probe />);
    await act(async () => {
      hydrateRoot(container, <Probe />);
    });
    expect(container.textContent).toBe('desktop');
  });
});
