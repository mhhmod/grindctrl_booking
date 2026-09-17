import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
  type MantineThemeComponents,
  virtualColor,
} from '@mantine/core';

/* Mantine theme for the merchant SaaS surfaces, bridged to the app's own
   design tokens in app/globals.css so a Mantine component and a Tailwind
   one render the same brand.

   Two layers, on purpose:
   - Palettes: Mantine computes shades, hover states and contrast in JS, so
     it needs real colors. These tuples are sRGB conversions of the oklch
     tokens (theme.test.ts fails if a token moves and a palette does not).
   - cssVariablesResolver: every semantic Mantine variable (body, text,
     borders, dimmed, errors) points at the app token itself, so those stay
     a single source of truth and follow the `.dark` class. */

/* The app's primary is charcoal in light mode and cream in dark mode, so the
   primary is a virtual color over two palettes. Mantine reads fixed shades
   per scheme (see getCSSColorVariables), which is why these tuples are laid
   out by role rather than as a light-to-dark ramp:
   light: 6 filled, 7 filled hover, 1 / 2 light variant, 9 light variant text
   dark:  7 filled, 8 filled hover, 9 source of the light variant background
          (darkened by Mantine), 3 outline and text, 0 light variant text */
const inkLight: MantineColorsTuple = [
  '#f6f3ee', '#e3dfda', '#d4d0cb', '#a7a4a0', '#837f7c',
  '#66625f', '#201d1b', '#2e2b28', '#3a3734', '#201d1b',
];

const inkDark: MantineColorsTuple = [
  '#eeebe5', '#e3dfdb', '#d4d0cc', '#d4d0cc', '#a7a4a0',
  '#837f7c', '#66635f', '#eeebe5', '#e3dfdb', '#504c49',
];

/* Mantine's red with the filled shades (6 light, 7 dark) and their hovers
   dark enough for cream text at WCAG AA. Stock red-6 with white is 3:1. */
const red: MantineColorsTuple = [
  '#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787',
  '#ff6b6b', '#c92a2a', '#b02525', '#9c1f1f', '#7f1a1a',
];

/* Mantine's light-mode neutrals: gray-0 is --card, gray-1 --background,
   gray-2 --secondary, gray-4 --border, gray-6 --muted-foreground. */
const gray: MantineColorsTuple = [
  '#f6f3ee', '#f0ece8', '#e3dfda', '#dbd7d2', '#d4d0cb',
  '#a8a49f', '#66625f', '#504c48', '#383531', '#201d1b',
];

/* Mantine's dark-mode neutrals: dark-0 is --foreground, dark-2 --muted-foreground,
   dark-4 --border, dark-6 --secondary, dark-7 --card, dark-8 --background. */
const dark: MantineColorsTuple = [
  '#eeebe5', '#c7c3c0', '#9d9790', '#74716e', '#262321',
  '#1f1c1a', '#191714', '#12100e', '#090807', '#050403',
];

const PRIMARY = 'brand';
const PRIMARY_CONTRAST = 'var(--mantine-primary-color-contrast)';

/* These components compute their text or icon contrast in JS, assuming light
   mode, and a virtual color has no luminance to measure. For the primary
   color they would put cream on cream in dark mode, so they use Mantine's
   per-scheme primary contrast instead. Other colors keep Mantine's own
   calculation. Keyed by component name, so no component code is imported. */
function primaryContrast(selector: string, variable: string) {
  return {
    vars: (_theme: unknown, props: { color?: string }) =>
      !props.color || props.color === PRIMARY ? { [selector]: { [variable]: PRIMARY_CONTRAST } } : {},
  };
}

const components: MantineThemeComponents = {
  Checkbox: primaryContrast('root', '--checkbox-icon-color'),
  CheckboxIndicator: primaryContrast('indicator', '--checkbox-icon-color'),
  Radio: primaryContrast('root', '--radio-icon-color'),
  RadioIndicator: primaryContrast('indicator', '--radio-icon-color'),
  Indicator: primaryContrast('root', '--indicator-text-color'),
  Pagination: primaryContrast('root', '--pagination-active-color'),
  Stepper: primaryContrast('root', '--stepper-icon-color'),
  Tabs: primaryContrast('root', '--tabs-text-color'),
  Timeline: primaryContrast('root', '--tl-icon-color'),
  /* Progress sections set their label color inline with no theme hook, so
     auto contrast is off here and styles.css supplies the label color. */
  Progress: { defaultProps: { autoContrast: false } },
  ProgressRoot: { defaultProps: { autoContrast: false } },
};

export const mantineTheme = createTheme({
  primaryColor: PRIMARY,
  primaryShade: { light: 6, dark: 7 },
  colors: {
    inkLight,
    inkDark,
    red,
    gray,
    dark,
    brand: virtualColor({ name: PRIMARY, light: 'inkLight', dark: 'inkDark' }),
  },
  white: '#f6f3ee',
  black: '#201d1b',
  autoContrast: true,
  /* Where white and black text give equal contrast for this theme's cream
     white and charcoal black, so auto contrast always picks the stronger one. */
  luminanceThreshold: 0.195,
  fontFamily: 'var(--font-sans)',
  headings: { fontFamily: 'var(--font-heading)' },
  /* Tailwind's 2 / 3 / 4 / 6 / 8 steps, so Mantine gaps land on the app's rhythm. */
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  defaultRadius: 'md',
  /* Same steps as the Tailwind radius scale built from --radius. */
  radius: {
    xs: 'calc(var(--radius) * 0.4)',
    sm: 'calc(var(--radius) * 0.6)',
    md: 'calc(var(--radius) * 0.8)',
    lg: 'var(--radius)',
    xl: 'calc(var(--radius) * 1.4)',
  },
  /* Same widths as Tailwind's sm/md/lg/xl, so `sm` means 640px in both
     systems. Media queries in component CSS must use these values too. */
  breakpoints: {
    xs: '36em',
    sm: '40em',
    md: '48em',
    lg: '64em',
    xl: '80em',
  },
  cursorType: 'pointer',
  components,
});

const tokens = {
  '--mantine-color-body': 'var(--card)',
  '--mantine-color-text': 'var(--foreground)',
  '--mantine-color-bright': 'var(--foreground)',
  '--mantine-color-dimmed': 'var(--muted-foreground)',
  '--mantine-color-placeholder': 'var(--muted-foreground)',
  '--mantine-color-anchor': 'var(--foreground)',
  '--mantine-color-error': 'var(--destructive)',
  '--mantine-color-default': 'var(--background)',
  '--mantine-color-default-hover': 'var(--accent)',
  '--mantine-color-default-color': 'var(--foreground)',
  '--mantine-color-default-border': 'var(--input)',
  '--mantine-color-disabled': 'var(--muted)',
  '--mantine-color-disabled-color': 'var(--muted-foreground)',
  '--mantine-color-disabled-border': 'var(--border)',
};

/* The token map is the same in both schemes because the tokens themselves
   switch with `.dark`. It is repeated per scheme so it outranks Mantine's own
   scheme defaults, which sit on the more specific attribute selectors. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: { '--mantine-line-height': '1.5', ...tokens },
  light: tokens,
  dark: tokens,
});
