/**
 * A tiny, browser-safe HTTP layer for the web client.
 *
 * Unlike the server-side {@link REST}, this one has zero Node dependencies (no
 * `node:events`) so the web entry stays clean in any bundler. It reuses the
 * shared error classes and powers the *optional* convenience methods of
 * {@link WebClient} (`createPay`, `validate`, …) — the core sign/submit flow
 * works without it.
 */

import {
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '@/errors/CosmosPayError';
import { version } from '@/util/Constants';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** Options for the browser REST client. */
export interface WebRESTOptions {
  baseURL: string;
  apiKey?: string;
  version?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

/** Per-request options. */
export interface WebRequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class WebREST {
  public baseURL: string;
  public readonly version: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly extraHeaders: Record<string, string>;
  private readonly fetchFn: typeof fetch;
  private apiKey?: string;

  constructor(options: WebRESTOptions) {
    if (!options.baseURL) throw new TypeError('WebREST requires a `baseURL`.');
    this.baseURL = options.baseURL.replace(/\/+$/, '');
    this.version = options.version ?? 'v1';
    this.timeout = options.timeout ?? 30_000;
    this.retries = options.retries ?? 2;
    this.extraHeaders = options.headers ?? {};
    this.apiKey = options.apiKey;

    const fetchFn = options.fetch ?? globalThis.fetch;
    if (typeof fetchFn !== 'function') {
      throw new TypeError(
        'No global `fetch` found. Pass a `fetch` implementation in the client options.',
      );
    }
    this.fetchFn = fetchFn.bind(globalThis);
  }

  public setApiKey(apiKey: string): this {
    this.apiKey = apiKey;
    return this;
  }

  public get<T>(path: string, options: WebRequestOptions = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  public post<T>(path: string, options: WebRequestOptions = {}): Promise<T> {
    return this.request<T>('POST', path, options);
  }

  public patch<T>(path: string, options: WebRequestOptions = {}): Promise<T> {
    return this.request<T>('PATCH', path, options);
  }

  private buildURL(path: string, query?: WebRequestOptions['query']): string {
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
      'User-Agent': `@cosmosapp/pay_sdk/${version} (web)`,
      ...this.extraHeaders,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['apikey'] = this.apiKey;
    }
    return { ...headers, ...extra };
  }

  public async request<T>(
    method: string,
    path: string,
    options: WebRequestOptions = {},
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
      const signal = mergeSignals(options.signal, controller.signal);
      try {
        const response = await this.fetchFn(url, {
          method,
          headers,
          body: serializedBody,
          signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          const body = await safeParse(response);
          if (RETRYABLE_STATUS.has(response.status) && attempt < this.retries) {
            await sleep(backoff(response, attempt));
            attempt++;
            continue;
          }
          throw new CosmosPayAPIError({ status: response.status, method, url, body });
        }
        return (await safeParse(response)) as T;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof CosmosPayAPIError) throw error;
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
}

// ── helpers ──────────────────────────────────────────────────────────────────

function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

function backoff(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  const ms = retryAfter ? Number(retryAfter) * 1000 : backoffDelay(attempt);
  return Number.isFinite(ms) ? ms : backoffDelay(attempt);
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

function mergeSignals(
  external: AbortSignal | undefined,
  internal: AbortSignal,
): AbortSignal {
  if (!external) return internal;
  const controller = new AbortController();
  const onAbort = (signal: AbortSignal) => () => controller.abort(signal.reason);
  for (const signal of [external, internal]) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', onAbort(signal), { once: true });
  }
  return controller.signal;
}
