import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { afterEach } from 'vitest';

vi.mock('server-only', () => ({}));

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

/* jsdom has no matchMedia at all. Framer Motion's useReducedMotion() guards
   on matchMedia support and silently treats "unsupported" as "not reduced",
   so without this a JS-driven animate() with repeat: Infinity (the
   collaborations marquee) runs for real under every render and its frame
   loop keeps the process alive past the test run — the suite hangs instead
   of failing loudly. Reporting reduced-motion as true here is deliberate,
   not just a safe default: it exercises the same "motion stops, content
   stays readable" path real users with the OS setting on hit, keeps tests
   deterministic, and matches dashboard-shell.test.tsx's existing per-file
   matchMedia mock, which still overrides this for its own tests. */
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
});
