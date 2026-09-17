import * as React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { cssVariablesResolver, mantineTheme } from './theme';

/* Mantine components throw without a provider. env="test" turns off
   transitions and portals so assertions see the final DOM in place. */
export function renderWithMantine(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <MantineProvider theme={mantineTheme} cssVariablesResolver={cssVariablesResolver} env="test">
        {children}
      </MantineProvider>
    ),
  });
}
