import { attemptTurnstileToken } from './turnstile-client';
import type { TryOnAttempt } from './types';

export type ClientLookTimings = { attempt_ms?: number; check_ms?: number; upload_ms?: number; check_prewarmed?: boolean };
const TAP_WAIT_MS = 8000;

export type PreparedLook ={ attempt: TryOnAttempt; token?: string; timings: ClientLookTimings; expires: number };

/** Owned by one photo/session, never shared or persisted. Taking a prepared
 * look consumes it before any network request, including a failed upload. */
export class LookPreparation {
  private controller = new AbortController();
  private ready?: PreparedLook;
  private pending?: Promise<void>;

  constructor(private readonly request: (signal: AbortSignal) => Promise<TryOnAttempt>) {}

  warm(): void {
    if (this.pending || this.controller.signal.aborted) return;
    this.pending = this.prepare(true).then((look) => {
      if (!this.controller.signal.aborted) this.ready = look;
    }).catch(() => {});
  }

  async take(signal?: AbortSignal): Promise<PreparedLook> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // A background check still running is usually seconds from done, and it
    // gives up by itself the moment Cloudflare needs the shopper, so waiting
    // briefly beats starting over. Bounded, so a slow check never holds the tap.
    if (!this.ready && this.pending) {
      await Promise.race([this.pending, new Promise((resolve) => setTimeout(resolve, TAP_WAIT_MS))]);
    }
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ready = this.ready;
    this.ready = undefined;
    this.controller.abort();
    if (ready && ready.expires > Date.now()) return ready;
    return this.prepare(false, signal ?? new AbortController().signal);
  }

  abort(): void { this.ready = undefined; this.controller.abort(); }

  private async prepare(background: boolean, signal = this.controller.signal): Promise<PreparedLook> {
    const start = performance.now();
    const attempt = await this.request(signal);
    const attempt_ms = performance.now() - start;
    const checkStart = performance.now();
    const token = await attemptTurnstileToken(attempt.turnstile, { signal, background });
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { attempt, token,
      // Leave a margin for request transit before Cloudflare's 300s limit.
      expires: Math.min(Date.now() + 290_000, Date.parse(attempt.expiresAt) || Date.now() + 290_000),
      timings: { attempt_ms, check_ms: attempt.turnstile ? performance.now() - checkStart : 0,
        check_prewarmed: background && !!attempt.turnstile } };
  }
}
