/** Library version, kept in sync with package.json. */
export const version = '1.0.0';

/**
 * Default base URL of the Cosmos Pay gateway. Maintained by Cosmos Pay — users
 * never need to set this; it's part of the {@link shared} configuration. Override
 * only when self-hosting or pointing at a staging gateway.
 */
export const DEFAULT_BASE_URL = 'https://api.cosmospay.io';

/** Default API version segment prefixed to every route (`/v1/...`). */
export const DEFAULT_VERSION = 'v1';

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 30_000;

/** Default number of retries for transient failures (network / 429 / 5xx). */
export const DEFAULT_RETRIES = 2;

/** Default HMAC signature header sent by the Cosmos Pay webhook dispatcher. */
export const SIGNATURE_HEADER = 'x-cosmos-signature';

/**
 * Client debug/telemetry events. The {@link Client} extends EventEmitter and
 * emits these for observability — mirroring discord.js's `debug`/`rateLimit`.
 */
export const Events = {
  Debug: 'debug',
  Request: 'request',
  Response: 'response',
  RateLimited: 'rateLimited',
} as const;
export type ClientEvent = (typeof Events)[keyof typeof Events];
