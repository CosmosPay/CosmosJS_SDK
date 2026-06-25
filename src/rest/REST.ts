import { EventEmitter } from 'node:events';
import {
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '@/errors/CosmosPayError';
import {
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT,
  DEFAULT_VERSION,
  Events,
  version,
} from '@/util/Constants';

/** A `fetch`-compatible function (defaults to the global `fetch`). */
export type FetchLike = typeof fetch;

/** Options accepted when constructing a {@link REST} instance. */
export interface RESTOptions {
  /**
   * Base URL of the Cosmos Pay gateway (no trailing slash), e.g.
   * `https://api.cosmospay.lat/cosmos-api`. The version segment is appended
   * automatically.
   */
  baseURL: string;
  /**
   * API key issued by the Cosmos developer platform. Sent as
   * `Authorization: Bearer <apiKey>` (and `apikey: <apiKey>`) to the gateway.
   */
  apiKey?: string;
  /**
   * Shared gateway secret (`X-Gateway-Secret`). Only needed when calling the
   * service directly (bypassing APISIX) — typically local development.
   */
  gatewaySecret?: string;
  /**
   * Authenticated consumer username (`X-Consumer-Username`). Pair with
   * `gatewaySecret` for direct service access.
   */
  consumerUsername?: string;
  /**
   * API version segment prefixed to every route. Defaults to `v1`. Set to an
   * empty string when your gateway already injects the version.
   */
  version?: string;
  /** Per-request timeout in milliseconds (default 30000). */
  timeout?: number;
  /** Retries for transient failures — network errors, 429 and 5xx (default 2). */
  retries?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (e.g. a polyfill on old runtimes). */
  fetch?: FetchLike;
}

/** Internal options for a single request. */
export interface RequestOptions {
  /** Query string parameters; `undefined`/`null` values are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON body to send. */
  body?: unknown;
  /** Per-request header overrides. */
  headers?: Record<string, string>;
  /** Per-request AbortSignal. */
  signal?: AbortSignal;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * The HTTP layer. Owns the base URL, authentication and retry/timeout policy,
 * and exposes thin verb helpers (`get`/`post`/`patch`/`delete`). Managers call
 * these — they never touch `fetch` directly.
 */
export class REST extends EventEmitter {
  public baseURL: string;
  public readonly version: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly fetchFn: FetchLike;
  private readonly extraHeaders: Record<string, string>;
  private apiKey?: string;
  private gatewaySecret?: string;
  private consumerUsername?: string;

  constructor(options: RESTOptions) {
    super();
    if (!options.baseURL) {
      throw new TypeError('REST requires a `baseURL`.');
    }
    this.baseURL = options.baseURL.replace(/\/+$/, '');
    this.version = options.version ?? DEFAULT_VERSION;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.extraHeaders = options.headers ?? {};
    this.apiKey = options.apiKey;
    this.gatewaySecret = options.gatewaySecret;
    this.consumerUsername = options.consumerUsername;

    const fetchFn = options.fetch ?? globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      throw new TypeError(
        'No global `fetch` found. Use Node.js >= 18 or pass a `fetch` implementation in the client options.',
      );
    }
    this.fetchFn = fetchFn.bind(globalThis);
  }

  /** Replace the API key used for subsequent requests. */
  public setApiKey(apiKey: string): this {
    this.apiKey = apiKey;
    return this;
  }

  /** Set direct-access gateway credentials (local/dev usage). */
  public setGatewayCredentials(secret: string, consumerUsername: string): this {
    this.gatewaySecret = secret;
    this.consumerUsername = consumerUsername;
    return this;
  }

  public get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  public post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  public patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }

  public delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /** Build the absolute URL for a route, applying the version prefix + query. */
  public buildURL(path: string, query?: RequestOptions['query']): string {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const prefix = this.version ? `/${this.version}` : '';
    const url = new URL(`${this.baseURL}${prefix}${clean}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': `@cosmosapp/pay_sdk/${version}`,
      ...this.extraHeaders,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['apikey'] = this.apiKey;
    }
    if (this.gatewaySecret) headers['X-Gateway-Secret'] = this.gatewaySecret;
    if (this.consumerUsername) {
      headers['X-Consumer-Username'] = this.consumerUsername;
    }
    return { ...headers, ...extra };
  }

  /** Core request with retry, timeout and structured error handling. */
  public async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildURL(path, options.query);
    const headers = this.buildHeaders(options.headers);

    let serializedBody: string | undefined;
    if (options.body !== undefined) {
      serializedBody = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.retries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const signal = options.signal
        ? anySignal([options.signal, controller.signal])
        : controller.signal;

      this.emit(Events.Request, { method, url, attempt });

      try {
        const response = await this.fetchFn(url, {
          method,
          headers,
          body: serializedBody,
          signal,
        });
        clearTimeout(timer);

        this.emit(Events.Response, {
          method,
          url,
          status: response.status,
          attempt,
        });

        if (response.status === 429) {
          this.emit(Events.RateLimited, { method, url, attempt });
        }

        if (!response.ok) {
          const body = await safeParse(response);
          if (RETRYABLE_STATUS.has(response.status) && attempt < this.retries) {
            await this.backoff(response, attempt);
            attempt++;
            continue;
          }
          throw new CosmosPayAPIError({ status: response.status, method, url, body });
        }

        return (await safeParse(response)) as T;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof CosmosPayAPIError) throw error;

        // Network/abort/timeout → retry, then surface as a request error.
        lastError = error;
        if (attempt < this.retries) {
          await sleep(backoffDelay(attempt));
          attempt++;
          continue;
        }
        throw new CosmosPayRequestError({ method, url, cause: error });
      }
    }

    throw new CosmosPayRequestError({ method, url, cause: lastError });
  }

  private async backoff(response: Response, attempt: number): Promise<void> {
    const retryAfter = response.headers.get('retry-after');
    const ms = retryAfter
      ? Number(retryAfter) * 1000
      : backoffDelay(attempt);
    await sleep(Number.isFinite(ms) ? ms : backoffDelay(attempt));
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeParse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/** Combine multiple AbortSignals into one (first to abort wins). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = (signal: AbortSignal) => () => controller.abort(signal.reason);
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', onAbort(signal), { once: true });
  }
  return controller.signal;
}
