import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoryController, tryOnAliasDestination } from './story-controller';
import { PausableTimers } from './story-timers';

/* The story follows the browser's own scrolling. These tests pin that down:
   no wheel or touch listener (a non-passive one holds every scroll until the
   main thread answers), one passive scroll listener, nothing measured while
   a frame runs, and beats entered only once the scroll has stayed near them. */

const ENV = { layout: 'desk', stacked: false, reduce: false, rtl: false } as const;

it('sends old Try-On demo aliases to the studio without changing other scene links', () => {
  expect(tryOnAliasDestination('#try')).toBe('/try-on');
  expect(tryOnAliasDestination('#demo')).toBe('/try-on');
  expect(tryOnAliasDestination('#store')).toBeNull();
  expect(tryOnAliasDestination('#journey')).toBeNull();
});
/* Where each marker sits on the page. The fake layout reports it relative to the scroll. */
const BEAT_Y: Record<string, number> = {
  'tryon:0': 0,
  'tryon:1': 100,
  'tryon:2': 200,
  'tryon:3': 300,
  'store:0': 1000,
  'store:1': 1100,
  'store:2': 1200,
  'store:3': 1300,
};
const REST_Y = 5000;

let scrollY = 0;
let scrollReads = 0;
let root: HTMLElement;
let controller: StoryController;

function buildRoot() {
  const el = document.createElement('div');
  const section = (scene: string, y: number) => {
    const s = document.createElement('section');
    s.dataset.scene = scene;
    s.dataset.y = String(y);
    el.appendChild(s);
  };
  section('tryon', 0);
  section('store', 1000 - 300);
  Object.entries(BEAT_Y).forEach(([id, y]) => {
    const i = document.createElement('i');
    i.dataset.beat = id;
    i.dataset.y = String(y);
    el.appendChild(i);
  });
  const rest = document.createElement('div');
  rest.dataset.k = 'rest';
  rest.dataset.y = String(REST_Y);
  el.appendChild(rest);
  document.body.appendChild(el);
  return el;
}

function scrollToY(y: number) {
  scrollY = y;
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  vi.useFakeTimers();
  scrollY = 0;
  scrollReads = 0;
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => {
      scrollReads++;
      return scrollY;
    },
  });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = Number((this as HTMLElement).dataset.y ?? 0) - scrollY;
    return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  root = buildRoot();
  controller = new StoryController(ENV, 'en');
});

afterEach(() => {
  controller.unmount();
  root.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the story director follows native scrolling', () => {
  it('listens to one passive scroll event and never to wheel, touch or resize input', () => {
    const add = vi.spyOn(window, 'addEventListener');
    controller.mount(root, ENV);
    const types = add.mock.calls.map(([type]) => type);
    expect(types).not.toContain('wheel');
    expect(types).not.toContain('touchmove');
    expect(types).not.toContain('touchstart');
    expect(types).not.toContain('resize');
    const scroll = add.mock.calls.find(([type]) => type === 'scroll');
    expect(scroll?.[2]).toEqual({ passive: true });
    expect(types.filter((type) => type === 'scroll')).toHaveLength(1);
  });

  it('leaves a wheel gesture alone', () => {
    controller.mount(root, ENV);
    const wheel = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('measures nothing while a frame runs', () => {
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    const measure = vi.mocked(Element.prototype.getBoundingClientRect);
    measure.mockClear();
    for (let y = 40; y <= 640; y += 40) {
      scrollToY(y);
      vi.advanceTimersByTime(16);
    }
    expect(measure).not.toHaveBeenCalled();
  });

  it('reads the scroll position once per scroll event and not again in the frame', () => {
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    scrollReads = 0;
    /* Six events, 16ms apart: short of the beat dwell, so nothing else reads it. */
    for (let y = 10; y <= 60; y += 10) {
      scrollToY(y);
      vi.advanceTimersByTime(16);
    }
    expect(scrollReads).toBe(6);
  });

  it('enters a beat only after the scroll has stayed near it', () => {
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    const seen: number[] = [];
    controller.subscribe(() => seen.push(controller.getState().sv));
    /* Passing over the store's first beats at speed enters none of them. */
    scrollToY(1100);
    vi.advanceTimersByTime(60);
    scrollToY(1200);
    vi.advanceTimersByTime(60);
    expect(seen).toEqual([]);
    scrollToY(1300);
    vi.advanceTimersByTime(40);
    expect(controller.getState().sCall).toBe(false);
    /* Staying on the last one does. */
    vi.advanceTimersByTime(200);
    expect(controller.getState().sCall).toBe(true);
    expect(seen.every((sv) => sv !== 1)).toBe(true);
  });

  it('rewinds to an earlier beat in place when the visitor scrolls back up', () => {
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    scrollToY(1300);
    vi.advanceTimersByTime(300);
    expect(controller.getState().sCall).toBe(true);
    scrollToY(1000);
    vi.advanceTimersByTime(300);
    expect(controller.getState().sCall).toBe(false);
    expect(controller.getState().sv).toBe(0);
  });

  it('holds beat scripts while scrolling and resumes them when it stops', () => {
    const pause = vi.spyOn(PausableTimers.prototype, 'pause');
    const resume = vi.spyOn(PausableTimers.prototype, 'resume');
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    pause.mockClear();
    resume.mockClear();
    scrollToY(10);
    scrollToY(20);
    scrollToY(30);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    scrollToY(40);
    vi.advanceTimersByTime(100);
    expect(resume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(resume).toHaveBeenCalled();
  });

  it('starts the demo chat when the visitor has stopped scrolling, not in the middle of a scroll', () => {
    class FakeObserver {
      static all: FakeObserver[] = [];
      targets: Element[] = [];
      constructor(public callback: IntersectionObserverCallback) {
        FakeObserver.all.push(this);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      unobserve() {}
      disconnect() {
        this.targets = [];
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const chat = document.createElement('section');
    chat.setAttribute('data-chat-scene', '');
    root.appendChild(chat);
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    scrollToY(10);
    const observer = FakeObserver.all.find((o) => o.targets.includes(chat))!;
    observer.callback([{ isIntersecting: true, target: chat } as unknown as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    expect(controller.getState().thread).toHaveLength(0);
    vi.advanceTimersByTime(400);
    expect(controller.getState().thread.length).toBeGreaterThan(0);
  });

  it('moves one beat per arrow key with the browser smooth scroll, not a script', () => {
    controller.mount(root, ENV);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' });
  });

  it('plays the beat it was sent to as soon as the move ends', () => {
    controller.mount(root, ENV);
    vi.advanceTimersByTime(300);
    scrollToY(1100);
    vi.advanceTimersByTime(300);
    expect(controller.getState().sAnn).toBe(5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'smooth' });
    /* Mid-move the beat waits; on arrival it plays without the usual dwell. */
    scrollToY(1160);
    vi.advanceTimersByTime(100);
    expect(controller.getState().sAnn).toBe(5);
    scrollToY(1200);
    window.dispatchEvent(new Event('scrollend'));
    expect(controller.getState().sAnn).toBe(0);
  });
});
