import { EventEmitter } from 'node:events';
import { AnalyticsManager } from '@/managers/AnalyticsManager';
import { CustomerManager } from '@/managers/CustomerManager';
import { HealthManager } from '@/managers/HealthManager';
import { LiquidityManager } from '@/managers/LiquidityManager';
import { OnrampManager } from '@/managers/OnrampManager';
import { OfframpManager } from '@/managers/OfframpManager';
import { ActivityManager } from '@/managers/ActivityManager';
import { KycManager } from '@/managers/KycManager';
import { PollarManager } from '@/managers/PollarManager';
import { PaymentIntentManager } from '@/managers/PaymentIntentManager';
import { ProductManager } from '@/managers/ProductManager';
import { SwapManager } from '@/managers/SwapManager';
import { WebhookManager } from '@/managers/WebhookManager';
import { REST, type FetchLike } from '@/rest/REST';
import { version } from '@/util/Constants';
import { resolveShared, shared, type SharedConfig } from '@/util/shared';

/**
 * Options accepted by the {@link Client} constructor.
 *
 * In practice the only value you provide is `apiKey` — everything else (the
 * gateway URL, version and other infrastructure details) is pre-filled from the
 * {@link Client.shared} defaults that Cosmos Pay maintains for you.
 */
export interface ClientOptions {
  /**
   * Your Cosmos Pay API key. Sent to the gateway as `Authorization: Bearer
   * <apiKey>`. The key type determines the network (`dv_` → testnet, `prod_` →
   * mainnet). This is the only credential a typical integration needs.
   */
  apiKey: string;

  /**
   * Default webhook signing secret used by the webhook listener
   * (`client.webhooks.on(...)` + handlers) when you don't pass one explicitly.
   */
  webhookSecret?: string;

  /** Per-request timeout in milliseconds (default 30000). */
  timeout?: number;
  /** Retries for transient failures — network errors, 429 and 5xx (default 2). */
  retries?: number;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (e.g. a polyfill on old runtimes). */
  fetch?: FetchLike;

  // ── Advanced / internal overrides (you normally never set these) ────────────
  /**
   * Override the gateway base URL. Defaults to {@link Client.shared}`.baseURL`.
   * Only needed for self-hosting or a staging gateway.
   * @internal
   */
  baseURL?: string;
  /**
   * Override the API version segment. Defaults to `v1`.
   * @internal
   */
  version?: string;
  /**
   * Shared gateway secret (`X-Gateway-Secret`) for direct, gateway-bypassing
   * access (local development). Maintained internally.
   * @internal
   */
  gatewaySecret?: string;
  /**
   * Consumer username (`X-Consumer-Username`) for direct access. Internal.
   * @internal
   */
  consumerUsername?: string;
}

/** Payloads emitted by the {@link Client} for observability. */
export interface ClientEvents {
  request: [{ method: string; url: string; attempt: number }];
  response: [{ method: string; url: string; status: number; attempt: number }];
  rateLimited: [{ method: string; url: string; attempt: number }];
  debug: [message: string];
}

export interface Client {
  on<E extends keyof ClientEvents>(
    event: E,
    listener: (...args: ClientEvents[E]) => void,
  ): this;
  once<E extends keyof ClientEvents>(
    event: E,
    listener: (...args: ClientEvents[E]) => void,
  ): this;
  off<E extends keyof ClientEvents>(
    event: E,
    listener: (...args: ClientEvents[E]) => void,
  ): this;
  emit<E extends keyof ClientEvents>(
    event: E,
    ...args: ClientEvents[E]
  ): boolean;
}

/**
 * The main entry point of the SDK — a single, atomic client that exposes every
 * resource through its own manager — an atomic, single-client design.
 *
 * @example
 * import { Client } from '@cosmosapp/pay_sdk';
 *
 * // The user only provides their API key — the gateway is handled for them.
 * const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });
 *
 * const intent = await client.paymentIntents.createPay({ destination: 'G...', amount: '10' });
 * console.log(intent.uri);
 */
export class Client extends EventEmitter {
  /** Library version. */
  public static readonly version = version;

  /**
   * Process-wide shared defaults maintained by Cosmos Pay (gateway URL, version,
   * internal secrets). Mutate once at startup to change them for every client
   * (e.g. self-hosting): `Client.shared.baseURL = 'https://gateway.your-domain.com'`.
   */
  public static readonly shared: SharedConfig = shared;

  /** Resolved shared configuration for this client instance. */
  public readonly shared: SharedConfig;

  /** Default webhook signing secret for the webhook listener (if configured). */
  public webhookSecret: string | undefined;

  /** The underlying HTTP layer. Shared by every manager. */
  public readonly rest: REST;

  /** Stellar payment intents — create/list/fetch/update/delete/validate. */
  public readonly paymentIntents: PaymentIntentManager;
  /** Webhook endpoints, delivery audit trail, and the event listener. */
  public readonly webhooks: WebhookManager;
  /** Products / prices. */
  public readonly products: ProductManager;
  /** Stellar swaps — quote/create/fetch/list/submit. */
  public readonly swaps: SwapManager;
  /** Liquidity pools: browse, positions, deposit / withdraw. */
  public readonly liquidity: LiquidityManager;
  /** Fiat -> stablecoin: quotes, payins, trustlines, virtual accounts. */
  public readonly onramp: OnrampManager;
  /** Stablecoin -> fiat: quotes, authorize, payouts, compliance documents. */
  public readonly offramp: OfframpManager;
  /** The client event stream: report events, read them back, summarize. */
  public readonly activity: ActivityManager;
  /** KYC / KYB: receivers, their wallets and their bank accounts. */
  public readonly kyc: KycManager;
  /** Pollar: social login, its sessions, and the custodial wallets behind them. */
  public readonly pollar: PollarManager;
  /** Customers. */
  public readonly customers: CustomerManager;
  /** Read-only analytics (summary, balances, logs). */
  public readonly analytics: AnalyticsManager;
  /** Service health probes (public). */
  public readonly health: HealthManager;

  constructor(options: ClientOptions) {
    super();
    if (!options || !options.apiKey) {
      throw new TypeError('Client requires an `apiKey` option.');
    }

    // Fill the infrastructure details from the shared defaults; the user only
    // had to bring their apiKey.
    this.shared = resolveShared({
      baseURL: options.baseURL,
      version: options.version,
      gatewaySecret: options.gatewaySecret,
      consumerUsername: options.consumerUsername,
      webhookSecret: options.webhookSecret,
    });
    this.webhookSecret = this.shared.webhookSecret;

    this.rest = new REST({
      baseURL: this.shared.baseURL,
      apiKey: options.apiKey,
      gatewaySecret: this.shared.gatewaySecret,
      consumerUsername: this.shared.consumerUsername,
      version: this.shared.version,
      timeout: options.timeout,
      retries: options.retries,
      headers: options.headers,
      fetch: options.fetch,
    });

    // Re-emit REST telemetry through the client so consumers can subscribe to
    // `client.on('request' | 'response' | 'rateLimited' | 'debug', ...)`.
    this.rest.on('request', (p) => this.emit('request', p));
    this.rest.on('response', (p) => this.emit('response', p));
    this.rest.on('rateLimited', (p) => this.emit('rateLimited', p));

    this.paymentIntents = new PaymentIntentManager(this);
    this.webhooks = new WebhookManager(this);
    this.products = new ProductManager(this);
    this.swaps = new SwapManager(this);
    this.liquidity = new LiquidityManager(this);
    this.onramp = new OnrampManager(this);
    this.offramp = new OfframpManager(this);
    this.activity = new ActivityManager(this);
    this.kyc = new KycManager(this);
    this.pollar = new PollarManager(this);
    this.customers = new CustomerManager(this);
    this.analytics = new AnalyticsManager(this);
    this.health = new HealthManager(this);
  }

  /** Update the API key used for subsequent requests. */
  public setApiKey(apiKey: string): this {
    this.rest.setApiKey(apiKey);
    return this;
  }

  /** Set the default webhook signing secret for the webhook listener. */
  public setWebhookSecret(secret: string): this {
    this.webhookSecret = secret;
    return this;
  }

  /** Set direct-access gateway credentials (internal / local dev usage). */
  public setGatewayCredentials(secret: string, consumerUsername: string): this {
    this.rest.setGatewayCredentials(secret, consumerUsername);
    return this;
  }
}
