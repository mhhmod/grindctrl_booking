import { describe, it, expect } from 'vitest';
import { validateUploadedFile, validateProductId, validateSessionId } from './validator';

describe('try-on validator', () => {
  describe('validateUploadedFile', () => {
    it('rejects missing file', () => {
      const result = validateUploadedFile(null as unknown as File);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('No file');
    });

    it('rejects unsupported file type', () => {
      const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' });
      const result = validateUploadedFile(file);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('rejects oversized file', () => {
      const size = 9 * 1024 * 1024; // 9 MB
      const file = new File([new ArrayBuffer(size)], 'big.jpg', { type: 'image/jpeg' });
      const result = validateUploadedFile(file);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('too large');
    });

    it('accepts a valid JPEG under size limit', () => {
      const file = new File(['image-data'], 'photo.jpg', { type: 'image/jpeg' });
      const result = validateUploadedFile(file);
      expect(result.ok).toBe(true);
    });

    it('accepts a valid PNG', () => {
      const file = new File(['image-data'], 'photo.png', { type: 'image/png' });
      const result = validateUploadedFile(file);
      expect(result.ok).toBe(true);
    });

    it('accepts a valid WebP', () => {
      const file = new File(['image-data'], 'photo.webp', { type: 'image/webp' });
      const result = validateUploadedFile(file);
      expect(result.ok).toBe(true);
    });
  });

  describe('validateProductId', () => {
    it('rejects empty product ID', () => {
      const result = validateProductId('');
      expect(result.ok).toBe(false);
    });

    it('rejects unknown product', () => {
      const result = validateProductId('unknown-product');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('accepts valid product ID', () => {
      const result = validateProductId('premium-ringer-tee');
      expect(result.ok).toBe(true);
    });
  });

  describe('validateSessionId', () => {
    it('rejects empty session ID', () => {
      const result = validateSessionId('');
      expect(result.ok).toBe(false);
    });

    it('rejects whitespace-only session ID', () => {
      const result = validateSessionId('   ');
      expect(result.ok).toBe(false);
    });

    it('accepts valid session ID', () => {
      const result = validateSessionId('sess_12345');
      expect(result.ok).toBe(true);
    });
  });
});
