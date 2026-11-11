// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
const globals = window as unknown as Record<string, unknown>;
afterEach(() => { delete globals.GrindctrlSupport; delete globals.__gc_widget_loader__; document.head.innerHTML = ''; vi.restoreAllMocks(); });
it('m10: failed runtime reports an error, retries on init and preserves queued work', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const event = vi.fn(); window.addEventListener('grindctrl:runtime-error', event);
  try {
    (0, eval)(readFileSync('public/widget/v1/loader.js', 'utf8'));
    const api = globals.GrindctrlSupport as { init: (config: unknown) => void; __attachRuntime: (runtime: { push: (value: unknown) => void }) => void };
    api.init({ embedKey: 'key' });
    const first = document.querySelector('script')!;
    first.dispatchEvent(new Event('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalled(); expect(event).toHaveBeenCalledTimes(1);
    api.init({ embedKey: 'key' });
    const retry = document.querySelector('script')!;
    expect(retry).not.toBe(first);
    const push = vi.fn(); api.__attachRuntime({ push });
    retry.dispatchEvent(new Event('load'));
    expect(push).toHaveBeenCalledWith({ embedKey: 'key' });
  } finally { window.removeEventListener('grindctrl:runtime-error', event); }
});
it('m10: the runtime hash replaces a loader query version without breaking the URL', () => {
  document.head.innerHTML = '<script src="https://grindctrl.cloud/widget/v1/loader.js?v=old&source=theme"></script>';
  (0, eval)(readFileSync('public/widget/v1/loader.js', 'utf8'));
  (globals.GrindctrlSupport as { init: (config: unknown) => void }).init({ embedKey: 'key' });
  const runtime = new URL(document.querySelector<HTMLScriptElement>('script:last-child')!.src);
  expect(runtime.pathname).toBe('/widget/v1/runtime.js');
  expect(runtime.searchParams.get('v')).toMatch(/^[0-9a-f]{12}$/);
  expect(runtime.searchParams.get('source')).toBe('theme');
});
