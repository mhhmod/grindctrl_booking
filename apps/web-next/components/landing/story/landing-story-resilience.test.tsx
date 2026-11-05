import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { AssistantLauncher } from '@/components/assistant/launcher';
import { createMockAssistantClient } from '@/lib/assistant/mock-client';
import { getAssistantDictionary } from '@/lib/assistant/i18n';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';
import { LandingStory } from './landing-story';
import { StoryController } from './story-controller';
import { storyText } from './story-vals';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('./views/desk-try', () => ({ DeskTry: () => null }));
vi.mock('./views/phone-try', () => ({
  PhoneTry: function FaultyScene() {
    const [fail, setFail] = React.useState(false);
    if (fail) throw new Error('Scene update failed');
    return <button onClick={() => setFail(true)}>Fail scene</button>;
  },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // Fail the layout actually on screen, as on the reported Android phone.
  // The shared jsdom default emulates reduced motion on a desktop instead.
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(max-width: 999.98px)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
  document.documentElement.style.scrollBehavior = 'smooth';
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.documentElement.style.scrollBehavior = '';
});

function renderPage(locale: 'en' | 'ar') {
  return render(<>
    <LandingLocaleProvider initialLocale={locale}><LandingStory /></LandingLocaleProvider>
    <AssistantLauncher initialLocale={locale} client={createMockAssistantClient()} />
  </>);
}

function checkIndependentControls(locale: 'en' | 'ar') {
  fireEvent.click(screen.getByRole('button', { name: getLandingDictionary(locale).siteOpenMenu }));
  const menu = screen.getByRole('dialog', { name: getLandingDictionary(locale).menu });
  expect(within(menu).getByRole('link', { name: getLandingDictionary(locale).signIn })).toBeInTheDocument();
  fireEvent.keyDown(menu, { key: 'Escape', code: 'Escape' });
  const assistant = getAssistantDictionary(locale);
  fireEvent.click(screen.getByRole('button', { name: assistant.launcherOpen }));
  expect(screen.getByRole('dialog', { name: 'GrindCTRL AI' })).toBeInTheDocument();
}

describe('landing story failure isolation', () => {
  it.each(['en', 'ar'] as const)('keeps the %s menu, assistant and native input usable after a scene update fails', (locale) => {
    vi.useFakeTimers();
    const mount = vi.spyOn(StoryController.prototype, 'mount');
    const unmount = vi.spyOn(StoryController.prototype, 'unmount');
    const { container } = renderPage(locale);
    const controller = mount.mock.contexts[0] as StoryController;
    expect(controller.mounted).toBe(true);
    controller.ask('person', false);
    document.documentElement.dataset.story = 'pinned';

    fireEvent.click(screen.getByRole('button', { name: 'Fail scene' }));

    expect(screen.getByRole('heading', { level: 1, name: storyText(locale)('The fitting room your online store was missing.') })).toBeInTheDocument();
    expect(unmount).toHaveBeenCalled();
    expect(controller.mounted).toBe(false);
    expect(document.documentElement).not.toHaveAttribute('data-story');
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    expect(container.querySelector('.gc-story')).not.toHaveAttribute('data-ready');
    const key = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    const messages = controller.state.thread;
    act(() => vi.advanceTimersByTime(6000));
    expect(controller.state.thread).toBe(messages);
    vi.useRealTimers();
    checkIndependentControls(locale);
  });

  it('cleans up a controller that throws part way through its mount effect', () => {
    const mount = StoryController.prototype.mount;
    let controller: StoryController | undefined;
    vi.spyOn(StoryController.prototype, 'mount').mockImplementation(function (this: StoryController, root, env) {
      controller = this;
      mount.call(this, root, env);
      document.documentElement.dataset.story = 'pinned';
      throw new Error('Director mount failed');
    });
    renderPage('en');
    expect(controller?.mounted).toBe(false);
    expect(document.documentElement).not.toHaveAttribute('data-story');
    expect(document.documentElement.style.scrollBehavior).toBe('smooth');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    checkIndependentControls('en');
  });
});
