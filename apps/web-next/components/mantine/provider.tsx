'use client';

import './styles.css';
import * as React from 'react';
import { DirectionProvider, MantineProvider } from '@mantine/core';
import { useTheme } from 'next-themes';
import { cssVariablesResolver, mantineTheme } from './theme';

/* next-themes owns light/dark (class on <html>, key "theme"); Mantine
   follows it rather than keeping a second preference. Before hydration,
   the ColorSchemeScript in app/layout.tsx sets Mantine's attribute from the
   same stored value. */
function ThemedMantine({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <MantineProvider
      theme={mantineTheme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    >
      {children}
    </MantineProvider>
  );
}

export function MantineUiProvider({ dir, children }: { dir: 'ltr' | 'rtl'; children: React.ReactNode }) {
  return (
    /* Server-resolved for the first render; after that Mantine follows
       <html dir>, which the locale switch updates. */
    <DirectionProvider initialDirection={dir}>
      <ThemedMantine>{children}</ThemedMantine>
    </DirectionProvider>
  );
}
