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
      expect(session.shop).toBeNull();
      expect(session.createdAt).toBeTruthy();
    });

    it('normalizes a storefront shop and rejects a bogus one', () => {
      expect(createSession('premium-ringer-tee', ' Store-One.MyShopify.com ').shop).toBe(
        'store-one.myshopify.com',
      );
      expect(createSession('premium-ringer-tee', 'https://attacker.example').shop).toBeNull();
    });

    it('throws for a malformed product ID', () => {
      expect(() => createSession('INVALID product!!')).toThrow();
    });
  });

  describe('generateTryOn', () => {
    it('requires photoSource parameter', async () => {
      await expect(
        generateTryOn('sess_test', 'premium-ringer-tee', '' as never),
      ).rejects.toThrow('photoSource');
    });

    it('generates a mock job with photoSource=upload', async () => {
      const job = await generateTryOn(
        'sess_test',
        'premium-ringer-tee',
        'upload',
        undefined,
        undefined,
        undefined,
        'store-one.myshopify.com',
      );
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.shop).toBe('store-one.myshopify.com');
      expect(job.meta.runtime).toBe('mock');
      expect(job.resultImageUrl).toBeTruthy();
    });

    it('generates a mock job with photoSource=mock', async () => {
      const job = await generateTryOn('sess_test', 'premium-ringer-tee', 'mock');
      expect(job).toBeDefined();
      expect(job.status).toBe('completed');
      expect(job.shop).toBeNull();
      expect(job.meta.runtime).toBe('mock');
    });

    it('rejects a bogus shop on the generated job', async () => {
      const job = await generateTryOn(
        'sess_test',
        'premium-ringer-tee',
        'mock',
        undefined,
        undefined,
        undefined,
        'not-a-shop.example',
      );
      expect(job.shop).toBeNull();
    });
  });
});
