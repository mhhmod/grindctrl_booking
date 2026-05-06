import { describe, it, expect } from 'vitest';
import { createSession, generateTryOn, getTryOnMode } from './service';

describe('try-on service', () => {
  describe('getTryOnMode', () => {
    it('defaults to mock when TRYON_MODE is not set', () => {
      const original = process.env.TRYON_MODE;
      delete process.env.TRYON_MODE;
      expect(getTryOnMode()).toBe('mock');
      if (original !== undefined) process.env.TRYON_MODE = original;
    });
  });

  describe('createSession', () => {
    it('creates a session for a valid product', () => {
      const session = createSession('premium-ringer-tee');
      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^sess_/);
      expect(session.productId).toBe('premium-ringer-tee');
      expect(session.createdAt).toBeTruthy();
    });

    it('throws for an invalid product', () => {
      expect(() => createSession('invalid')).toThrow();
    });
  });

  describe('generateTryOn', () => {
    it('requires photoSource parameter', async () => {
      await expect(
        generateTryOn('sess_test', 'premium-ringer-tee', '' as never),
      ).rejects.toThrow('photoSource');
    });

    it('generates a mock job with photoSource=upload', async () => {
      const job = await generateTryOn('sess_test', 'premium-ringer-tee', 'upload');
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.meta.runtime).toBe('mock');
      expect(job.resultImageUrl).toBeTruthy();
    });

    it('generates a mock job with photoSource=mock', async () => {
      const job = await generateTryOn('sess_test', 'premium-ringer-tee', 'mock');
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.meta.runtime).toBe('mock');
    });
  });
});
