import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { PhotoUpload } from '@/components/try-on/photo-upload';
import { TryOnLocaleProvider } from '@/components/try-on/locale-provider';
import { getDictionary } from './i18n';
import { photoFileError, readPhotoAsDataUrl } from './photo-file';
import { TRYON_FILE_CONFIG } from './types';

vi.mock('./performance', () => ({ recordTryOnPhase: vi.fn() }));

const ENCODED = 'data:image/jpeg;base64,cHJlcGFyZWQ=';

/* One real EXIF APP1 directory, orientation 6. The decoder mock represents
   the browser's EXIF-aware result: portrait dimensions, already rotated. */
function exifJpeg(orientation: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0, 0,
    0x49, 0x49, 0x2a, 0, 0x08, 0, 0, 0, 0x01, 0,
    0x12, 0x01, 0x03, 0, 0x01, 0, 0, 0, orientation, 0, 0, 0,
    0, 0, 0, 0, 0xff, 0xd9,
  ]);
}

describe('device-side photo preparation', () => {
  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
  let context: {
    drawImage: ReturnType<typeof vi.fn>; getImageData: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>; fillStyle: string; globalCompositeOperation: string;
    imageSmoothingEnabled: boolean; imageSmoothingQuality: string;
  };
  let canvas: HTMLCanvasElement;
  let encode: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    bitmap = { width: 4032, height: 3024, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
    context = {
      drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([4, 5, 6, 255]) })),
      fillRect: vi.fn(), fillStyle: '', globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      canvas = this;
      return context as unknown as CanvasRenderingContext2D;
    });
    encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(ENCODED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downscales a 12 MP JPEG to 1536 on the long side at high JPEG quality', async () => {
    const file = new File(['jpeg'], 'phone.jpg', { type: 'image/jpeg' });
    expect(await readPhotoAsDataUrl(file)).toBe(ENCODED);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect([canvas.width, canvas.height]).toEqual([1536, 1152]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1536, 1152);
    expect(context.imageSmoothingQuality).toBe('high');
    expect(encode).toHaveBeenCalledWith('image/jpeg', 0.9);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('keeps a smaller JPEG byte-for-byte without upscaling or re-encoding', async () => {
    bitmap.width = 800; bitmap.height = 600;
    expect(await readPhotoAsDataUrl(new File(['small'], 'small.jpg', { type: 'image/jpeg' })))
      .toBe('data:image/jpeg;base64,c21hbGw=');
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });

  it('also keeps a smaller opaque PNG unchanged', async () => {
    bitmap.width = 800; bitmap.height = 600;
    expect(await readPhotoAsDataUrl(new File(['opaque'], 'small.png', { type: 'image/png' })))
      .toBe('data:image/png;base64,b3BhcXVl');
    expect(encode).not.toHaveBeenCalled();
  });

  it('flattens a transparent PNG on white even below the size threshold', async () => {
    bitmap.width = 800; bitmap.height = 600;
    context.getImageData.mockReturnValue({ data: new Uint8ClampedArray([4, 5, 6, 0]) });
    expect(await readPhotoAsDataUrl(new File(['alpha'], 'alpha.png', { type: 'image/png' }))).toBe(ENCODED);
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
    expect(context.globalCompositeOperation).toBe('destination-over');
    expect(context.fillStyle).toBe('#fff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(context.drawImage.mock.invocationCallOrder[0]).toBeLessThan(context.fillRect.mock.invocationCallOrder[0]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8])('bakes EXIF orientation %s into a small JPEG instead of retaining its metadata', async (orientation) => {
    bitmap.width = 600; bitmap.height = 800;
    const file = new File([exifJpeg(orientation)], 'portrait.jpg', { type: 'image/jpeg' });
    expect(await readPhotoAsDataUrl(file)).toBe(ENCODED);
    expect([canvas.width, canvas.height]).toEqual([600, 800]);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 600, 800);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
  });

  it('keeps EXIF orientation 1 JPEGs unchanged', async () => {
    bitmap.width = 600; bitmap.height = 800;
    const result = await readPhotoAsDataUrl(new File([exifJpeg(1)], 'upright.jpg', { type: 'image/jpeg' }));
    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(encode).not.toHaveBeenCalled();
  });

  it('does not advertise HEIC/HEIF, which the generation endpoint rejects', () => {
    expect(TRYON_FILE_CONFIG.allowedTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(photoFileError(new File(['heic'], 'photo.heic', { type: 'image/heic' }), getDictionary('en')))
      .toMatch(/Unsupported file type/);
  });

  it('surfaces the existing friendly error when an image cannot be decoded', async () => {
    vi.mocked(createImageBitmap).mockRejectedValue(new Error('codec detail must not reach the shopper'));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:bad'), revokeObjectURL: vi.fn() });
    vi.stubGlobal('Image', class {
      onerror: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onerror?.()); }
    });
    render(<TryOnLocaleProvider initialLocale="en">
      <PhotoUpload onFileSelected={vi.fn()} onFileClear={vi.fn()} previewUrl={null} />
    </TryOnLocaleProvider>);
    fireEvent.change(document.querySelector('#photo-upload-input')!, {
      target: { files: [new File(['broken'], 'bad.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.'));
    expect(screen.queryByText(/codec detail/)).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bad');
  });
});
