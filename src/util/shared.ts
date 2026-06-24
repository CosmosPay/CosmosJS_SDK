import { DEFAULT_BASE_URL, DEFAULT_VERSION } from '@/util/Constants';

/**
 * Internal ("shared") configuration that Cosmos Pay maintains on the user's
 * behalf. These are the gateway / infrastructure details an integrator should
 * **not** have to know about — they're pre-filled here so that, in practice, the
 * only credential a user provides is their `apiKey`.
 *
 * Every value is overridable (per-client via {@link ClientOptions}, or globally
 * via {@link Client.shared}) for self-hosting, staging or local development.
 */
export interface SharedConfig {
  /** Base URL of the Cosmos Pay gateway. */
  baseURL: string;
  /** API version segment prefixed to every route (`/v1/...`). */
  version: string;
  /**
   * Shared gateway secret (`X-Gateway-Secret`). Only used when talking to the
   * service directly, bypassing the gateway (local development). Internal.
   */
  gatewaySecret?: string;
  /**
   * Authenticated consumer username (`X-Consumer-Username`). Paired with
   * `gatewaySecret` for direct service access. Internal.
   */
  consumerUsername?: string;
  /**
   * Default webhook signing secret used by the webhook listener
   * (`client.webhooks.process` / handlers) when no secret is passed explicitly.
   */
  webhookSecret?: string;
}

/**
 * The mutable, process-wide defaults. Cosmos Pay ships sane values here; you can
 * tweak them once at startup (e.g. `Client.shared.baseURL = '...'`) and every
 * client created afterwards inherits them.
 */
export const shared: SharedConfig = {
  baseURL: DEFAULT_BASE_URL,
  version: DEFAULT_VERSION,
};

/** Merge a partial override on top of the current shared defaults. */
export function resolveShared(overrides: Partial<SharedConfig> = {}): SharedConfig {
  const defined: Partial<SharedConfig> = {};
  for (const key of Object.keys(overrides) as (keyof SharedConfig)[]) {
    const value = overrides[key];
    if (value !== undefined) {
      Object.assign(defined, { [key]: value });
    }
  }
  return { ...shared, ...defined };
}
