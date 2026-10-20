// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TryOnLocaleProvider } from '../locale-provider';
import type { PhoneStore } from '@/lib/try-on/phone-store';
import { TryOnSheet } from './try-on-sheet';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

/* The sheet's photo, check and consent steps (02-try-on.md) over the same
   flow today's embed uses. The flow itself is covered by try-on-demo's
   tests; here it records what the sheet asks of it. */
const flow = vi.hoisted(() => ({ generated: 0, selected: [] as string[] }));
vi.mock('../use-try-on-flow', async () => {
  const { useCallback, useState } = await import('react');
  return {
    useTryOnFlow: () => {
      const [step, setStep] = useState<'upload' | 'consent' | 'generating'>('upload');
      const [photoDataUrl, setPhoto] = useState<string | null>(null);
      const [generationStartedAt, setStartedAt] = useState<number | null>(null);
      const selectPhoto = useCallback((dataUrl: string) => {
        flow.selected.push(dataUrl);
        setPhoto(dataUrl);
        setStep('consent');
      }, []);
      return {
        step,
        photoDataUrl,
        generationStartedAt,
        sessionState: 'ready',
        sessionError: null,
        job: null,
        error: null,
        unavailable: false,
        selectPhoto,
        clearPhoto: () => {
          setPhoto(null);
          setStep('upload');
        },
        generate: async () => {
          flow.generated += 1;
          setStartedAt(Date.now());
          setStep('generating');
        },
        retrySession: () => {},
        reset: () => setStep('upload'),
      };
    },
  };
});
vi.mock('@/lib/try-on/photo-check', () => ({ checkPhoto: async () => ({ light: true, sharp: true, issue: null }) }));
const phone = vi.hoisted(() => ({ store: null as PhoneStore | null }));
vi.mock('@/lib/try-on/phone-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/try-on/phone-store')>();
  return { ...real, phoneStore: () => phone.store };
});

const PRODUCT = { handle: 'layla-abaya', name: 'Layla Embroidered Abaya', imageUrl: 'https://cdn.shopify.com/s/files/garment.png' };

function renderSheet(props: Partial<React.ComponentProps<typeof TryOnSheet>> = {}, locale: 'en' | 'ar' = 'en') {
  return render(
    <TryOnLocaleProvider initialLocale={locale}>
      <TryOnSheet
        product={PRODUCT}
        variantId="456"
        variantTitle="Black / M"
        shop="demo.myshopify.com"
        lookSeconds={20}
        addressForm="everyone"
        {...props}
      />
    </TryOnLocaleProvider>,
  );
}

async function pickPhoto() {
  await screen.findByRole('heading', { name: 'See it on you' });
  const gallery = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
  fireEvent.change(gallery, { target: { files: [new File(['photo'], 'me.png', { type: 'image/png' })] } });
  await screen.findByText('Looks great');
}

beforeEach(async () => {
  const real = await vi.importActual<typeof import('@/lib/try-on/phone-store')>('@/lib/try-on/phone-store');
  phone.store = real.createPhoneStore(real.memoryBackend());
  flow.generated = 0;
  flow.selected = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the v16 try-on sheet', () => {
  it('shows the product with the variant the shopper picked', async () => {
    renderSheet();
    expect(screen.getByText('Layla Embroidered Abaya')).toBeInTheDocument();
    expect(screen.getByText('Black · M')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'See it on you' });
  });

  it('shows the product alone when it has no variants', async () => {
    renderSheet({ variantTitle: 'Default Title' });
    await screen.findByRole('heading', { name: 'See it on you' });
    expect(screen.queryByText('Default Title')).toBeNull();
  });

  it('asks for consent once, stores it on the phone and keeps the photo', async () => {
    const first = renderSheet();
    await pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Agree and try it on' }));

    await waitFor(() => expect(flow.generated).toBe(1));
    expect(await phone.store!.hasConsent()).toBe(true);
    const kept = await phone.store!.photo();
    expect(kept).toMatch(/^data:image\/png;base64,/);
    first.unmount();

    // The next try-on on this phone starts at the check with the kept photo,
    // and does not ask again.
    renderSheet();
    await screen.findByText('Looks great');
    expect(flow.selected.at(-1)).toBe(kept);
    expect(screen.queryByRole('heading', { name: 'See it on you' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Before your first try-on' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try it on' })).toBeEnabled();
  });

  it('keeps nothing on the phone when the shopper turns it off', async () => {
    renderSheet();
    await pickPhoto();
    fireEvent.click(screen.getByRole('switch', { name: /Keep my photo on this phone/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Agree and try it on' }));

    await waitFor(() => expect(flow.generated).toBe(1));
    expect(await phone.store!.keepOnPhone()).toBe(false);
    expect(await phone.store!.photo()).toBeNull();
    // Consent is its own answer, kept apart from the photo.
    expect(await phone.store!.hasConsent()).toBe(true);
  });

  it('opens how photos are handled, and comes back', async () => {
    renderSheet();
    await screen.findByRole('heading', { name: 'See it on you' });
    fireEvent.click(screen.getByRole('button', { name: 'How photos are handled' }));
    expect(screen.getByRole('heading', { name: 'How photos are handled' })).toBeInTheDocument();
    expect(screen.getByText(/stays here for 24 hours/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to photo options' }));
    expect(screen.getByRole('heading', { name: 'See it on you' })).toBeInTheDocument();
  });

  it('speaks Arabic in the form the store chose', async () => {
    renderSheet({ addressForm: 'women' }, 'ar');
    expect(await screen.findByRole('heading', { name: 'شاهديها عليكِ' })).toBeInTheDocument();
    expect(screen.getByText(/يستغرق الأمر حوالي 20 ثانية\./)).toBeInTheDocument();
  });

  it("makes the look on the store's own estimate, step by step, and says each step once", async () => {
    renderSheet({ lookSeconds: 12 });
    await pickPhoto();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    fireEvent.click(screen.getByRole('button', { name: 'Agree and try it on' }));
    await act(async () => {});

    expect(await screen.findByRole('heading', { name: 'Making your look' })).toBeInTheDocument();
    expect(screen.getByText('About 12 seconds left')).toBeInTheDocument();
    const live = screen.getAllByRole('status').find((node) => node.classList.contains('sr-only'))!;
    expect(live).toHaveTextContent('Reading your photo');
    const steps = within(screen.getByRole('list'));
    expect(steps.getByText('Reading your photo').closest('li')).toHaveAttribute('aria-current', 'step');

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText('About 7 seconds left')).toBeInTheDocument();
    expect(steps.getByText('Fitting the garment').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(steps.getByText('Reading your photo').closest('li')).not.toHaveAttribute('aria-current');
    expect(live).toHaveTextContent('Fitting the garment');

    // Past the estimate: the last step holds and the seconds go, never zero.
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.queryByText(/seconds? left/)).toBeNull();
    expect(steps.getByText('Rendering your look').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it("uses the store's own steps and loading style, and promises no time without an estimate", async () => {
    renderSheet({ lookSeconds: null, loadingSteps: ['Measuring', 'Draping'], loadingStyle: 'bar' });
    await pickPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Agree and try it on' }));

    expect(await screen.findByRole('heading', { name: 'Making your look' })).toBeInTheDocument();
    expect(screen.queryByText(/seconds? left/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getAllByText('Measuring').length).toBeGreaterThan(0);
  });
});
