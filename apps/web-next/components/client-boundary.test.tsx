import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientBoundary } from './client-boundary';

afterEach(() => vi.restoreAllMocks());

describe('ClientBoundary', () => {
  it('does not add markup around a healthy surface', () => {
    const { container } = render(<ClientBoundary fallback={null}><p>Content</p></ClientBoundary>);
    expect(container.innerHTML).toBe('<p>Content</p>');
  });

  it.each(['render', 'effect'] as const)('isolates a %s failure and runs cleanup without unmounting siblings', (phase) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanup = vi.fn();
    const onError = vi.fn();
    const error = new Error('Surface failed');
    function Surface() {
      React.useEffect(() => {
        if (phase === 'effect') throw error;
        return cleanup;
      }, []);
      if (phase === 'render') throw error;
      return <p>Surface</p>;
    }
    function Sibling() {
      const [open, setOpen] = React.useState(false);
      return <button onClick={() => setOpen(!open)}>{open ? 'Open' : 'Closed'}</button>;
    }
    render(<><Sibling /><ClientBoundary fallback={<p>Fallback</p>} onError={onError}><Surface /></ClientBoundary></>);
    expect(screen.getByText('Fallback')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(error, expect.objectContaining({ componentStack: expect.any(String) }));
    fireEvent.click(screen.getByRole('button', { name: 'Closed' }));
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('unmounts a failed surface and accepts a localized fallback update', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanup = vi.fn();
    function Surface({ fail }: { fail: boolean }) {
      React.useEffect(() => cleanup, []);
      if (fail) throw new Error('Update failed');
      return <p>Surface</p>;
    }
    const { rerender } = render(<ClientBoundary fallback={<p>English</p>}><Surface fail={false} /></ClientBoundary>);
    rerender(<ClientBoundary fallback={<p>English</p>}><Surface fail /></ClientBoundary>);
    expect(cleanup).toHaveBeenCalledOnce();
    rerender(<ClientBoundary fallback={<p>العربية</p>}><Surface fail /></ClientBoundary>);
    expect(screen.getByText('العربية')).toBeInTheDocument();
  });
});
