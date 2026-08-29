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

/** True for the one provider error worth retrying with a DIFFERENT model.
 *  Anything else — auth, rate limit, a malformed image — repeats identically
 *  on every candidate and must not cost a request each to rediscover.
 *
 *  Reads the cause: withGroqCall and the vision client both replace the
 *  provider's message with a generic user-facing sentence and keep the real
 *  one underneath. Providers phrase this several ways — 404 model_not_found,
 *  400 "decommissioned", OpenRouter's "no endpoints found" — and all of them
 *  mean the same thing to a caller holding a candidate list. */
export function isModelNotFound(error: unknown): boolean {
  return /model_not_found|does not exist or you do not have access|decommissioned|no longer supported|no endpoints found|not a valid model/i.test(
    describeProviderError(error),
  );
}
