'use client';

import './styles.css';
import * as React from 'react';
import { DirectionProvider, MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { useTheme } from 'next-themes';
import { cssVariablesResolver, mantineTheme } from './theme';

/* Mantine sets the color-scheme attribute from its manager in a layout
   effect, before forceColorScheme is applied. Pointed at its own unused key
   it answered "light" there, so a dark-mode visitor got one light frame on
   every load. Reading next-themes' key makes that first answer the right one. */
const colorSchemeManager = localStorageColorSchemeManager({ key: 'theme' });

/* next-themes owns light/dark (class on <html>, key "theme"); Mantine
   follows it rather than keeping a second preference. Before hydration,
   the ColorSchemeScript in app/layout.tsx sets Mantine's attribute from the
   same stored value. */
function ThemedMantine({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <MantineProvider
      theme={mantineTheme}
      colorSchemeManager={colorSchemeManager}
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
