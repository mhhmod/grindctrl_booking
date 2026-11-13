/* The fixture's screens and state variants, readable by the server page. */
export const SURFACES = [
  'today', 'today-calm', 'today-setup', 'tryon', 'tryon-empty', 'tryon-error', 'tryon-setup',
  'store', 'store-outdated', 'store-new', 'settings', 'plan', 'plan-zero', 'plan-none', 'chat-products', 'team', 'claim', 'onboarding',
  'connect', 'connect-code',
] as const;
export type Surface = (typeof SURFACES)[number];
