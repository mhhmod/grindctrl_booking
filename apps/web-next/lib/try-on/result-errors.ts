export class TryOnResultUnavailableError extends Error {
  readonly code = 'TRYON_RESULT_UNAVAILABLE' as const;

  constructor(readonly jobId: string) {
    super('A completed try-on result is no longer available.');
    this.name = 'TryOnResultUnavailableError';
  }
}

export class TryOnFinalizationPendingError extends Error {
  readonly code = 'TRYON_FINALIZATION_PENDING' as const;

  constructor(readonly jobId: string) {
    super('The generated try-on result is awaiting billing reconciliation.');
    this.name = 'TryOnFinalizationPendingError';
  }
}

export class TryOnResultSchemaNotReadyError extends Error {
  readonly code = 'TRYON_RESULT_SCHEMA_NOT_READY' as const;

  constructor(readonly jobId: string) {
    super('Durable try-on result storage is not ready.');
    this.name = 'TryOnResultSchemaNotReadyError';
  }
}

export class TryOnResultPersistenceError extends Error {
  readonly code = 'TRYON_RESULT_PERSISTENCE_FAILED' as const;

  constructor(readonly jobId: string) {
    super('The generated try-on result could not be stored safely.');
    this.name = 'TryOnResultPersistenceError';
  }
}
