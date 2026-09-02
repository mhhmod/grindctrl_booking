// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  bootstrapStorefrontProof,
  clearPendingStorefrontProof,
  getPendingStorefrontProof,
  resetStorefrontProofForTests,
} from './storefront-bootstrap';

const NONCE = 'abcdefghijklmnopqrstuvwx';
const TOKEN = 'header.payload.signature';

describe('storefront proof bootstrap', () => {
  beforeEach(() => {
    resetStorefrontProofForTests();
    window.history.replaceState({}, '', '/embed/try-on?product=tee');
  });

  it('extracts the proof and removes it from hash and browser history immediately', () => {
    window.history.replaceState(
      { marker: true },
      '',
      `/embed/try-on?product=tee#storefrontContext=${TOKEN}&storefrontNonce=${NONCE}`,
    );

    expect(bootstrapStorefrontProof()).toEqual({ token: TOKEN, nonce: NONCE });
    expect(window.location.href).toBe('http://localhost:3000/embed/try-on?product=tee');
    expect(window.history.state).toEqual({ marker: true });
    expect(getPendingStorefrontProof()).toEqual({ token: TOKEN, nonce: NONCE });
  });

  it('scrubs incomplete proof without retaining it', () => {
    window.history.replaceState({}, '', `/embed/try-on#storefrontContext=${TOKEN}`);

    expect(bootstrapStorefrontProof()).toBeNull();
    expect(window.location.hash).toBe('');
    expect(getPendingStorefrontProof()).toBeNull();
  });

  it('keeps only unrelated fragment state and clears the in-memory proof', () => {
    window.history.replaceState(
      {},
      '',
      `/embed/try-on#panel=upload&storefrontContext=${TOKEN}&storefrontNonce=${NONCE}`,
    );
    bootstrapStorefrontProof();
    clearPendingStorefrontProof();

    expect(window.location.hash).toBe('#panel=upload');
    expect(getPendingStorefrontProof()).toBeNull();
  });
});
