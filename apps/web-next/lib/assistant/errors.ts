export class RateLimitedError extends Error {
  readonly resetSeconds: number;
  readonly signInCta: boolean;

  constructor(resetSeconds: number, signInCta: boolean, message = "You've reached your limit for now.") {
    super(message);
    this.name = 'RateLimitedError';
    this.resetSeconds = resetSeconds;
    this.signInCta = signInCta;
  }
}

export class ProviderUnavailableError extends Error {
  /* The message is shopper-facing and deliberately says nothing. The cause
     is what actually happened — a retired model, a missing key, a rate
     limit — and dropping it on the floor is what makes every provider
     failure look identical from the outside. Keep it for logs and event
     payloads; never render it to a user. */
  constructor(message = "We're having trouble reaching the AI right now.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProviderUnavailableError';
  }
}

/** One line naming the real cause, for a log or an internal event payload.
 *  Not for display: provider errors quote request details verbatim. */
export function describeProviderError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) return `${error.message} — ${cause.message}`;
  if (typeof cause === 'string' && cause) return `${error.message} — ${cause}`;
  return error.message;
}

export class BadInputError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'BadInputError';
    this.reason = reason;
  }
}
