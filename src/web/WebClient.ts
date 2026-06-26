/**
 * The browser ("web client") entry point of the SDK.
 *
 * Where the server-side {@link Client} just *creates* SEP-7 intents, the
 * {@link WebClient} *completes* them in the browser: it auto-detects whichever
 * Stellar wallet the user has (Freighter, xBull, Rabet, LOBSTR, Albedo, …),
 * adapts the Cosmos Pay response into a concrete transaction the wallet can
 * understand (these wallets don't consume SEP-7 URIs directly), asks for a
 * signature, and optionally broadcasts it — all without you ever naming a
 * provider.
 *
 * @example
 * import { WebClient } from '@cosmosapp/pay_sdk/web';
 *
 * // `intent` is whatever your server returned from client.paymentIntents.createPay(...)
 * const webClient = new WebClient();
 * const result = await webClient.pay(intent); // detects the wallet, builds, signs, submits
 * console.log(result.txHash, result.account);
 */

import type {
  CreatePayPaymentIntentOptions,
  CreateTxPaymentIntentOptions,
  PaymentIntentData,
  ValidationOutcomeData,
} from '@/types/index';
import { resolveIntentBody } from '@/common/intent-input';
import {
  defaultAdapters,
  type InjectedWallets,
} from '@/web/adapters/index';
import { IntentError } from '@/web/errors';
import { resolveNetwork } from '@/web/network';
import { normalizeIntent } from '@/web/sep7';
import {
  buildPaymentXdr,
  loadStellarSdk,
  postToCallback,
  submitToHorizon,
  transactionHash,
} from '@/web/stellar';
import { WalletRegistry } from '@/web/WalletRegistry';
import { WebREST } from '@/web/rest';
import { DEFAULT_BASE_URL } from '@/util/Constants';
import type { WalletId } from '@/common/wallets';
import type {
  ConnectResult,
  NetworkConfig,
  NormalizedIntent,
  PayableInput,
  PayOptions,
  PayResult,
  StellarNetwork,
  StellarSdkLike,
  WalletAdapter,
  WalletInfo,
} from '@/web/types';

/** Options for {@link WebClient}. Every field is optional. */
export interface WebClientOptions extends InjectedWallets {
  /**
   * Replace the entire wallet adapter set. By default the common wallets are
   * auto-registered; you rarely need this — use {@link WebClient.registerWallet}
   * to add one instead.
   */
  wallets?: WalletAdapter[];
  /** Reorder auto-detection priority by wallet id, e.g. `[Wallets.XBULL, Wallets.FREIGHTER]`. */
  preferredWallets?: WalletId[];

  /** Force the network instead of inferring it from the intent. */
  network?: StellarNetwork;
  /** Override the network passphrase. */
  passphrase?: string;
  /** Override the Horizon endpoint used to load accounts / submit. */
  horizonUrl?: string;

  /**
   * Provide `@stellar/stellar-sdk` explicitly. Otherwise it's lazy-imported when
   * needed (building a `pay` transaction, hashing, submitting to Horizon).
   */
  stellarSdk?: StellarSdkLike;
  /** Base fee in stroops for built transactions (default: SDK `BASE_FEE`). */
  baseFee?: string;
  /** Validity window in seconds for built transactions (default 300). */
  timeoutSeconds?: number;

  /**
   * Optional Cosmos Pay API key, enabling the convenience methods
   * `createPay`/`createTx`/`validate` directly from the browser. ⚠️ Only use a
   * key that's safe to expose client-side (e.g. a testnet `dv_` key); for
   * production, create & validate intents on your server.
   */
  apiKey?: string;
  /** Override the gateway base URL (advanced). */
  baseURL?: string;
  /** Override the API version segment (advanced). */
  version?: string;
  /** Per-request timeout in ms for the optional REST calls. */
  timeout?: number;
  /** Retries for the optional REST calls. */
  retries?: number;
  /** Extra headers for the optional REST calls. */
  headers?: Record<string, string>;
  /** Custom fetch implementation. */
  fetch?: typeof fetch;
}

export class WebClient {
  /** The wallet adapter registry (auto-detection + custom registration). */
  public readonly wallets: WalletRegistry;

  private readonly options: WebClientOptions;
  private readonly injectedSdk?: StellarSdkLike;
  private readonly fetchFn: typeof fetch;
  private rest?: WebREST;

  /** The most recent successful connection (wallet + address + network). */
  public connection: ConnectResult | null = null;

  constructor(options: WebClientOptions = {}) {
    this.options = options;
    this.injectedSdk = options.stellarSdk;
    const fetchFn = options.fetch ?? globalThis.fetch;
    this.fetchFn = typeof fetchFn === 'function' ? fetchFn.bind(globalThis) : fetchFn;

    const adapters =
      options.wallets ??
      defaultAdapters({
        freighter: options.freighter,
        xBull: options.xBull,
        rabet: options.rabet,
        albedo: options.albedo,
        lobstr: options.lobstr,
      });
    this.wallets = new WalletRegistry(reorder(adapters, options.preferredWallets));

    if (options.apiKey) {
      this.rest = new WebREST({
        baseURL: options.baseURL ?? DEFAULT_BASE_URL,
        apiKey: options.apiKey,
        version: options.version,
        timeout: options.timeout,
        retries: options.retries,
        headers: options.headers,
        fetch: options.fetch,
      });
    }
  }

  // ── Wallet discovery & connection ──────────────────────────────────────────

  /** Probe and list wallets, flagging which are currently available. */
  public getAvailableWallets(): Promise<WalletInfo[]> {
    return this.wallets.list();
  }

  /** Register a custom wallet adapter (WalletConnect, Ledger, …). */
  public registerWallet(adapter: WalletAdapter, prepend = false): this {
    this.wallets.register(adapter, prepend);
    return this;
  }

  /**
   * Auto-detect a wallet and connect, returning the account + network. You can
   * skip this and call {@link pay} directly — it connects on demand.
   */
  public async connect(
    options: { wallet?: WalletId; network?: StellarNetwork } = {},
  ): Promise<ConnectResult> {
    const adapter = await this.wallets.detect(options.wallet);
    const network = resolveNetwork({
      network: options.network ?? this.options.network,
      passphrase: this.options.passphrase,
      horizonUrl: this.options.horizonUrl,
    });
    const address = await adapter.getPublicKey(network);
    this.connection = { wallet: adapter.id, address, network: network.network };
    return this.connection;
  }

  /** Forget the current connection (and disconnect the adapter if it supports it). */
  public async disconnect(): Promise<void> {
    if (this.connection) {
      const adapter = this.wallets.get(this.connection.wallet);
      await adapter?.disconnect?.();
    }
    this.connection = null;
  }

  // ── The full flow ──────────────────────────────────────────────────────────

  /**
   * The one-call happy path: detect a wallet, adapt the intent into a
   * transaction, sign it, and (unless told otherwise) broadcast it. Works for
   * both `tx` intents (signs the returned XDR) and `pay` intents (builds the
   * payment from the connected account).
   */
  public async pay(
    input: PayableInput,
    options: PayOptions = {},
  ): Promise<PayResult> {
    const intent = normalizeIntent(input);
    const network = this.networkFor(intent);
    const adapter = await this.wallets.detect(options.wallet);

    const account = await adapter.getPublicKey(network);
    this.connection = {
      wallet: adapter.id,
      address: account,
      network: network.network,
    };

    const { xdr, source } = await this.prepare(intent, network, account, options);

    const signedXdr = await adapter.signTransaction(xdr, {
      networkPassphrase: network.passphrase,
      network: network.network,
      address: source,
    });

    const result: PayResult = {
      intentId: intent.id,
      wallet: adapter.id,
      account: source,
      network: network.network,
      signedXdr,
      txHash: '',
      submitted: false,
    };

    // Sign-only mode.
    if (options.sign === true) {
      result.txHash = await this.hashOf(signedXdr, network);
      return result;
    }

    // SEP-7 callback takes precedence over Horizon, unless explicitly overridden.
    const useCallback = Boolean(intent.callback) && options.submit !== false;
    const shouldSubmit = options.submit !== false;

    if (useCallback) {
      result.response = await postToCallback(
        intent.callback as string,
        signedXdr,
        this.fetchFn,
      );
      result.submitted = true;
    } else if (shouldSubmit) {
      const sdk = await this.sdk();
      result.response = await submitToHorizon(sdk, network, signedXdr);
      result.submitted = true;
    }

    result.txHash =
      extractHash(result.response) || (await this.hashOf(signedXdr, network));
    return result;
  }

  /**
   * Adapt an intent into an unsigned transaction without signing it. Useful when
   * you want to inspect/confirm the XDR before prompting the wallet.
   */
  public async buildTransaction(
    input: PayableInput,
    options: PayOptions = {},
  ): Promise<{
    xdr: string;
    source: string;
    intent: NormalizedIntent;
    network: NetworkConfig;
  }> {
    const intent = normalizeIntent(input);
    const network = this.networkFor(intent);
    const account =
      options.source ??
      this.connection?.address ??
      (await (await this.wallets.detect(options.wallet)).getPublicKey(network));
    const { xdr, source } = await this.prepare(intent, network, account, options);
    return { xdr, source, intent, network };
  }

  // ── Optional REST convenience (requires an apiKey) ──────────────────────────

  /**
   * Create a `pay` intent directly from the browser. Requires a browser-safe
   * `apiKey` (trusted environments only). Accepts typed assets (`Assets.USDC`)
   * and named addresses.
   */
  public createPay(
    options: CreatePayPaymentIntentOptions,
  ): Promise<PaymentIntentData> {
    return this.api().post<PaymentIntentData>('/payment-intents/pay', {
      body: resolveIntentBody(options),
    });
  }

  /**
   * Create a `tx` intent directly from the browser. Requires a browser-safe
   * `apiKey` (trusted environments only). Accepts typed assets (`Assets.USDC`)
   * and named addresses.
   */
  public createTx(
    options: CreateTxPaymentIntentOptions,
  ): Promise<PaymentIntentData> {
    return this.api().post<PaymentIntentData>('/payment-intents/tx', {
      body: resolveIntentBody(options),
    });
  }

  /** Validate a submitted transaction against an intent. Requires an `apiKey`. */
  public validate(
    intentId: string,
    txHash: string,
  ): Promise<ValidationOutcomeData> {
    return this.api().post<ValidationOutcomeData>(
      `/payment-intents/${intentId}/validate`,
      { body: { txHash } },
    );
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** Resolve the SDK (injected wins, else lazy-import). */
  private sdk(): Promise<StellarSdkLike> {
    return loadStellarSdk(this.injectedSdk);
  }

  /** REST accessor that fails clearly when no apiKey was configured. */
  private api(): WebREST {
    if (!this.rest) {
      throw new IntentError(
        'This method needs an `apiKey`. Construct the WebClient with `{ apiKey }`, ' +
          'or (recommended) create/validate intents on your server.',
      );
    }
    return this.rest;
  }

  /** Combine the intent's network hint with the client's overrides. */
  private networkFor(intent: NormalizedIntent): NetworkConfig {
    return resolveNetwork({
      hint: intent.network,
      network: this.options.network,
      passphrase: this.options.passphrase,
      horizonUrl: this.options.horizonUrl,
    });
  }

  /** Turn a normalized intent into an unsigned XDR + the signing source. */
  private async prepare(
    intent: NormalizedIntent,
    network: NetworkConfig,
    account: string,
    options: PayOptions,
  ): Promise<{ xdr: string; source: string }> {
    if (intent.kind === 'tx') {
      if (!intent.xdr) {
        throw new IntentError('This `tx` intent has no XDR to sign.');
      }
      // The XDR is bound to its source; the connected account must match.
      if (intent.source && account && intent.source !== account) {
        throw new IntentError(
          `This transaction must be signed by ${intent.source}, but the connected ` +
            `wallet is ${account}. Switch accounts in your wallet and try again.`,
        );
      }
      return { xdr: intent.xdr, source: intent.source ?? account };
    }

    // `pay`: build the payment from the connected account.
    const source = options.source ?? account;
    const sdk = await this.sdk();
    const xdr = await buildPaymentXdr(sdk, network, {
      intent,
      source,
      amount: options.amount,
      baseFee: this.options.baseFee,
      timeoutSeconds: this.options.timeoutSeconds,
    });
    return { xdr, source };
  }

  /** Best-effort transaction hash via the SDK (empty string if unavailable). */
  private async hashOf(signedXdr: string, network: NetworkConfig): Promise<string> {
    try {
      const sdk = await this.sdk();
      return transactionHash(sdk, signedXdr, network.passphrase);
    } catch {
      return '';
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Reorder adapters so the preferred ids come first, preserving the rest. */
function reorder(
  adapters: WalletAdapter[],
  preferred?: string[],
): WalletAdapter[] {
  if (!preferred?.length) return adapters;
  const rank = new Map(preferred.map((id, i) => [id, i]));
  return [...adapters].sort((a, b) => {
    const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

/** Pull a transaction hash out of a Horizon (or callback) response, if present. */
function extractHash(response: unknown): string {
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if (typeof obj['hash'] === 'string') return obj['hash'];
    if (typeof obj['txHash'] === 'string') return obj['txHash'];
    if (typeof obj['tx_hash'] === 'string') return obj['tx_hash'];
  }
  return '';
}
