import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_RESILIENCE_SCRIPT } from './browser-resilience';

const nativeRemove = Node.prototype.removeChild;
const nativeInsert = Node.prototype.insertBefore;
let storageListeners: EventListener[];

function install() {
  // Execute the exact inline payload, rather than a second implementation.
  window.eval(BROWSER_RESILIENCE_SCRIPT);
}

function translate(text: Text) {
  const outer = document.createElement('font');
  outer.style.verticalAlign = 'inherit';
  const inner = outer.appendChild(document.createElement('font'));
  inner.style.verticalAlign = 'inherit';
  inner.textContent = text.textContent;
  text.parentNode!.replaceChild(outer, text);
  return outer;
}

beforeEach(() => {
  storageListeners = [];
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'storage') storageListeners.push(listener as EventListener);
    add(type, listener, options);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  for (const listener of storageListeners) window.removeEventListener('storage', listener, true);
  Node.prototype.removeChild = nativeRemove;
  Node.prototype.insertBefore = nativeInsert;
  Reflect.deleteProperty(window, '__gcBrowserResilience');
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('translation DOM recovery before hydration', () => {
  it('keeps native behavior, return values, and unrelated DOM errors', () => {
    install();
    const parent = document.createElement('div');
    const first = parent.appendChild(document.createTextNode('first'));
    const second = document.createTextNode('second');
    expect(parent.insertBefore(second, first)).toBe(second);
    expect(parent.removeChild(first)).toBe(first);
    expect(parent.insertBefore(first, null)).toBe(first);
    expect(() => parent.removeChild(document.createTextNode('missing'))).toThrow();
    parent.appendChild(document.createElement('font'));
    expect(() => parent.removeChild(document.createElement('span'))).toThrow();
    expect(() => parent.insertBefore(first, document.createElement('span'))).toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('recovers displaced translated text for removal and insertion, warning once', () => {
    install();
    const parent = document.createElement('div');
    const old = parent.appendChild(document.createTextNode('translated'));
    const font = translate(old);
    expect(parent.removeChild(old)).toBe(old);
    const fresh = document.createElement('span');
    fresh.textContent = 'new beat';
    expect(parent.insertBefore(fresh, old)).toBe(fresh);
    expect(parent).toContainElement(font);
    expect(parent).toContainElement(fresh);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps React controls alive when translated conditional text is removed', async () => {
    install();
    function Demo() {
      const [show, setShow] = React.useState(true);
      return <button onClick={() => setShow(!show)}>{show && 'a beat'}<span>control</span></button>;
    }
    render(<Demo />);
    const button = screen.getByRole('button');
    translate(button.firstChild as Text);
    await act(async () => button.click());
    expect(button).toContainElement(screen.getByText('control'));
    await act(async () => button.click());
    expect(button.textContent).toContain('a beat');
  });

  it('installs once per document', () => {
    install();
    const remove = Node.prototype.removeChild;
    const insert = Node.prototype.insertBefore;
    install();
    expect(Node.prototype.removeChild).toBe(remove);
    expect(Node.prototype.insertBefore).toBe(insert);
  });
});

describe('persisted theme schema', () => {
  it.each(['light dark', '{"old": true}', '{broken', 'null', 'system', ''])('clears invalid theme %j before providers mount', (value) => {
    localStorage.setItem('theme', value);
    localStorage.setItem('unrelated', 'kept');
    install();
    expect(localStorage.getItem('theme')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('kept');
  });

  it.each(['light', 'dark'])('preserves supported theme %s', (value) => {
    localStorage.setItem('theme', value);
    install();
    expect(localStorage.getItem('theme')).toBe(value);
  });

  it('tolerates browsers denying storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(install).not.toThrow();
    expect(Node.prototype.removeChild).not.toBe(nativeRemove);
  });

  it('validates cross-tab theme events before next-themes receives them', () => {
    install();
    const received: Array<string | null> = [];
    const listener = (event: StorageEvent) => received.push(event.newValue);
    window.addEventListener('storage', listener);
    localStorage.setItem('theme', 'light dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'light dark' }));
    expect(received).toEqual([null]);
    expect(localStorage.getItem('theme')).toBeNull();
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'dark' }));
    expect(received).toEqual([null, 'dark']);
    window.removeEventListener('storage', listener);
  });

  it('does not reset a local theme for an unrelated sessionStorage event', () => {
    localStorage.setItem('theme', 'dark');
    install();
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'invalid theme', storageArea: sessionStorage }));
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
