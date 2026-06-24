/**
 * Error thrown when the Cosmos Pay API responds with a non-2xx status.
 *
 * Carries the HTTP status, the parsed response body and the request context so
 * callers can branch on `error.status` (e.g. 404 → not found, 403 → gateway).
 */
export class CosmosPayAPIError extends Error {
  /** HTTP status code returned by the API. */
  public readonly status: number;
  /** HTTP method of the failed request. */
  public readonly method: string;
  /** Absolute URL of the failed request. */
  public readonly url: string;
  /** Parsed response body (object when JSON, string otherwise, or null). */
  public readonly body: unknown;
  /** Machine-readable error code extracted from the body when present. */
  public readonly code: string | undefined;

  constructor(options: {
    status: number;
    method: string;
    url: string;
    body: unknown;
  }) {
    const message = CosmosPayAPIError.resolveMessage(options.status, options.body);
    super(message);
    this.name = 'CosmosPayAPIError';
    this.status = options.status;
    this.method = options.method;
    this.url = options.url;
    this.body = options.body;
    this.code = CosmosPayAPIError.resolveCode(options.body);
    Error.captureStackTrace?.(this, CosmosPayAPIError);
  }

  private static resolveMessage(status: number, body: unknown): string {
    if (body && typeof body === 'object') {
      const maybe = body as { message?: unknown; error?: unknown };
      const msg = maybe.message ?? maybe.error;
      if (Array.isArray(msg)) return `[${status}] ${msg.join(', ')}`;
      if (typeof msg === 'string') return `[${status}] ${msg}`;
    }
    if (typeof body === 'string' && body.length) return `[${status}] ${body}`;
    return `[${status}] Request failed`;
  }

  private static resolveCode(body: unknown): string | undefined {
    if (body && typeof body === 'object') {
      const maybe = body as { code?: unknown; error?: unknown };
      if (typeof maybe.code === 'string') return maybe.code;
      if (typeof maybe.error === 'string') return maybe.error;
    }
    return undefined;
  }
}

/**
 * Error thrown when a request never reaches the API: network failure, abort or
 * timeout. Distinct from {@link CosmosPayAPIError}, which always has a status.
 */
export class CosmosPayRequestError extends Error {
  public readonly method: string;
  public readonly url: string;
  public readonly cause: unknown;

  constructor(options: { method: string; url: string; cause: unknown }) {
    const reason =
      options.cause instanceof Error ? options.cause.message : String(options.cause);
    super(`Request to ${options.method} ${options.url} failed: ${reason}`);
    this.name = 'CosmosPayRequestError';
    this.method = options.method;
    this.url = options.url;
    this.cause = options.cause;
    Error.captureStackTrace?.(this, CosmosPayRequestError);
  }
}
