import * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { cssVariablesResolver, mantineTheme } from './theme';

/* Mantine components throw without a provider. env="test" turns off
   portals and skips rendering transitions, but Transition still runs
   useTransition, which schedules rAF and a setTimeout whenever `mounted`
   flips. Honouring reduced motion (vitest.setup.ts reports it as on) puts
   useTransition on its synchronous zero-duration path, so no timer can
   outlive a test and fire after jsdom is torn down. */
const testTheme = { ...mantineTheme, respectReducedMotion: true };

export function renderWithMantine(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <MantineProvider theme={testTheme} cssVariablesResolver={cssVariablesResolver} env="test">
        {children}
      </MantineProvider>
    ),
  });
}
