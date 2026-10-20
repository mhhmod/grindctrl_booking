// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDictionary } from '@/lib/try-on/i18n';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';
import type { PhotoCheck } from '@/lib/try-on/photo-check';
import { SheetPhotoStep } from './sheet-photo-step';
import { SheetCheckStep } from './sheet-check-step';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const check = vi.hoisted(() => ({ result: null as PhotoCheck | null }));
vi.mock('@/lib/try-on/photo-check', () => ({ checkPhoto: async () => check.result }));

const GOOD: PhotoCheck = { light: true, sharp: true, issue: null } as PhotoCheck;
const DARK: PhotoCheck = { light: false, sharp: true, issue: 'dark' } as PhotoCheck;
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

afterEach(() => {
  check.result = null;
  vi.restoreAllMocks();
});

function photoStep(locale: 'en' | 'ar' = 'en', lookSeconds: number | null = 20) {
  const onPhoto = vi.fn();
  const onShowPrivacy = vi.fn();
  render(
    <SheetPhotoStep
      copy={getSheetCopy(locale)}
      t={getDictionary(locale)}
      lookSeconds={lookSeconds}
      onPhoto={onPhoto}
      onShowPrivacy={onShowPrivacy}
    />,
  );
  return { onPhoto, onShowPrivacy };
}

function checkStep(overrides: Partial<React.ComponentProps<typeof SheetCheckStep>> = {}) {
  const props = {
    copy: getSheetCopy('en'),
    photoDataUrl: PHOTO,
    firstTime: true,
    keepOnPhone: true,
    busy: false,
    onKeepOnPhone: vi.fn(),
    onDifferentPhoto: vi.fn(),
    onTryOn: vi.fn(),
    onShowPrivacy: vi.fn(),
    ...overrides,
  };
  render(<SheetCheckStep {...props} />);
  return props;
}

describe('the photo step', () => {
  it('coaches the photo and offers the camera and the gallery', () => {
    photoStep();
    expect(screen.getByRole('heading', { name: 'See it on you' })).toBeInTheDocument();
    expect(screen.getByText(/It takes about 20 seconds\./)).toBeInTheDocument();
    for (const tip of ['Head to feet in frame', 'Hijab and loose clothes are fine', 'Good light, plain wall']) {
      expect(screen.getByText(tip)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /Take a photo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose from your photos/ })).toBeInTheDocument();
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute('capture', 'user');
    expect(inputs[1]).not.toHaveAttribute('capture');
    // The model path stays hidden until the owner decides (item 27).
    expect(screen.queryByText(/model/i)).toBeNull();
  });

  it('drops the time sentence when the store has too few looks to be honest', () => {
    photoStep('en', null);
    expect(screen.queryByText(/It takes about/)).toBeNull();
  });

  it('reads the photo the shopper picks, and refuses a file it cannot use', async () => {
    const { onPhoto } = photoStep();
    const gallery = document.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    fireEvent.change(gallery, { target: { files: [new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG|PNG|jpg|png/);
    expect(onPhoto).not.toHaveBeenCalled();

    fireEvent.change(gallery, { target: { files: [new File(['photo'], 'me.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onPhoto).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/)));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens how photos are handled', () => {
    const { onShowPrivacy } = photoStep();
    fireEvent.click(screen.getByRole('button', { name: 'How photos are handled' }));
    expect(onShowPrivacy).toHaveBeenCalled();
  });

  it('speaks Arabic with Western digits', () => {
    photoStep('ar', 20);
    expect(screen.getByRole('heading', { name: 'القطعة عليك' })).toBeInTheDocument();
    expect(screen.getByText(/يستغرق الأمر حوالي 20 ثانية\./)).toBeInTheDocument();
  });
});

describe('the check on the phone', () => {
  it('says a good photo looks great and asks for consent the first time only', async () => {
    check.result = GOOD;
    const props = checkStep();
    expect(await screen.findByText('Looks great')).toBeInTheDocument();
    expect(screen.getByText('Bright and sharp')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Before your first try-on' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agree and try it on' }));
    expect(props.onTryOn).toHaveBeenCalledTimes(1);
  });

  it('skips the consent once the phone holds it', async () => {
    check.result = GOOD;
    checkStep({ firstTime: false });
    await screen.findByText('Looks great');
    expect(screen.queryByRole('heading', { name: 'Before your first try-on' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try it on' })).toBeEnabled();
  });

  it('waits for the check and for the session before trying on', async () => {
    check.result = GOOD;
    checkStep({ busy: true });
    await screen.findByText('Looks great');
    expect(screen.getByRole('button', { name: 'Agree and try it on' })).toBeDisabled();
  });

  it('names the fix for a dark photo, says nothing was sent, and lets the shopper go on anyway', async () => {
    check.result = DARK;
    const props = checkStep();
    expect(await screen.findByText('Find more light, facing a window if you can')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been sent yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try it on/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Take it again' }));
    expect(props.onDifferentPhoto).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Use this photo anyway' }));
    expect(screen.getByRole('button', { name: 'Agree and try it on' })).toBeEnabled();
    expect(screen.queryByText('Looks great')).toBeNull();
  });

  it('goes on without a verdict when the phone cannot check the photo', async () => {
    check.result = null;
    checkStep();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Agree and try it on' })).toBeEnabled());
    expect(screen.queryByText('Looks great')).toBeNull();
  });

  it('turns keeping the photo on this phone off and on', async () => {
    check.result = GOOD;
    const props = checkStep();
    const keep = await screen.findByRole('switch', { name: /Keep my photo on this phone/ });
    expect(keep).toBeChecked();
    fireEvent.click(keep);
    expect(props.onKeepOnPhone).toHaveBeenCalledWith(false);
  });

  it.each([
    ['women', 'وافقي وجربيها عليكِ', 'قبل تجربتكِ الأولى'],
    ['men', 'وافق وجربها عليك', 'قبل تجربتك الأولى'],
    ['everyone', 'موافقة وتجربة القطعة', 'قبل التجربة الأولى'],
  ] as const)('asks in the Arabic %s form', async (form, agree, title) => {
    check.result = GOOD;
    checkStep({ copy: getSheetCopy('ar', form) });
    expect(await screen.findByText('تبدو رائعة')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: agree })).toBeInTheDocument();
  });
});
