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
  constructor(message = "We're having trouble reaching the AI right now.") {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export class BadInputError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'BadInputError';
    this.reason = reason;
  }
}
