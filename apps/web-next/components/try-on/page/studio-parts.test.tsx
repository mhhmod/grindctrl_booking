import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getDictionary } from '@/lib/try-on/i18n';
import { makingProgress } from '@/lib/try-on/making-progress';
import { ActionBar, LookCard } from './studio-parts';
import { INITIAL_STATE, studioReducer } from './studio-state';

describe('studio controls and real progress', () => {
  it.each(['en', 'ar'] as const)('always shows Create and a disabled photo hint in %s', (locale) => {
    const t = getDictionary(locale);
    const onCreate = vi.fn();
    const { rerender } = render(<ActionBar t={t} state={INITIAL_STATE} look={null} canCompare={false} onCreate={onCreate} onTryAnother={vi.fn()} onCompare={vi.fn()} />);
    const create = screen.getByRole('button', { name: t.pageCreateLook });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription(t.pageNeedPhoto);
    const ready = studioReducer(INITIAL_STATE, { type: 'useSample' });
    rerender(<ActionBar t={t} state={ready} look={null} canCompare={false} onCreate={onCreate} onTryAnother={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.pageCreateLook })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: t.pageCreateLook }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it.each(['en', 'ar'] as const)('keeps the photo, real stage and sub-100 progress visible after the estimate in %s', (locale) => {
    const t = getDictionary(locale);
    const uploaded = studioReducer(INITIAL_STATE, { type: 'setUpload', dataUrl: 'data:image/jpeg;base64,YQ==' });
    const creating = studioReducer(uploaded, { type: 'create' });
    const { container } = render(<LookCard t={t} state={creating} look={null} progress={makingProgress({ elapsedMs: 35_000, estimateSeconds: 30, stage: 'making', stepCount: 3 })} status="later" failureMessage={null} retryLocked={false} onRetry={vi.fn()} onUseSample={vi.fn()} onView={vi.fn()} cardRef={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(t.pageProgressAlmost);
    expect(Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(100);
    expect(container.querySelector('img')).toHaveAttribute('src', uploaded.photo?.kind === 'upload' ? uploaded.photo.dataUrl : '');
    expect(container.textContent).not.toContain(t.pageProgressRemaining(0));
    expect(screen.getByText(t.pageProgressStages[1])).toBeInTheDocument();
  });

  it.each(['en', 'ar'] as const)('offers sign-up, not a retry or an error, once the demo looks are used in %s', (locale) => {
    const t = getDictionary(locale);
    const uploaded = studioReducer(INITIAL_STATE, { type: 'setUpload', dataUrl: 'data:image/jpeg;base64,YQ==' });
    const creating = studioReducer(uploaded, { type: 'create' });
    const failed = studioReducer(creating, { type: 'failed', request: creating.request, failure: { kind: 'demo_limit' } });
    render(<LookCard t={t} state={failed} look={null} progress={makingProgress({ elapsedMs: 0, estimateSeconds: 30, stage: null, stepCount: 3 })} status="later" failureMessage={t.pageDemoLimit} limitReached retryLocked={false} onRetry={vi.fn()} onUseSample={vi.fn()} onView={vi.fn()} cardRef={null} />);
    expect(screen.getByRole('status')).toHaveTextContent(t.pageDemoLimit);
    expect(screen.getByRole('link', { name: t.pageDemoLimitCta })).toHaveAttribute('href', '/sign-up');
    expect(screen.queryByRole('button', { name: t.tryAgain })).toBeNull();
    expect(screen.queryByText(t.errorTitle)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
