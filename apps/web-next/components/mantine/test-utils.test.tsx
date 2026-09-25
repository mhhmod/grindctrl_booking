import React from 'react';
import { act } from '@testing-library/react';
import { Button } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithMantine } from './test-utils';

/* Mantine's Transition calls useTransition unconditionally and only checks
   env="test" afterwards, to skip rendering. So a Button's loader still
   schedules real rAF and setTimeout work when `loading` flips. On a slow CI
   runner that timer can outlive the test file, fire after jsdom is torn
   down, and fail the whole run with "window is not defined". */
describe('renderWithMantine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves no transition timers pending when a component toggles', () => {
    vi.useFakeTimers();
    const { rerender } = renderWithMantine(<Button loading={false}>Save</Button>);

    act(() => {
      rerender(<Button loading>Save</Button>);
    });
    act(() => {
      rerender(<Button loading={false}>Save</Button>);
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});
