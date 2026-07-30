export class ZohoProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly safeMessage: string;

  constructor(input: {
    code: string;
    message: string;
    safeMessage: string;
    retryable: boolean;
    status?: number | null;
    cause?: unknown;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ZohoProviderError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.status = input.status ?? null;
    this.safeMessage = input.safeMessage;
  }
}

export function asZohoProviderError(error: unknown): ZohoProviderError {
  if (error instanceof ZohoProviderError) return error;
  return new ZohoProviderError({
    code: "ZOHO_UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : "Unknown Zoho error",
    safeMessage: "The accounting provider returned an unexpected error.",
    retryable: true,
    cause: error,
  });
}
