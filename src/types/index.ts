/**
 * Type definitions for the Cosmos Pay Payments API.
 *
 * These mirror the server's OpenAPI schema (Stellar SEP-7 payment intents,
 * webhooks, products, customers and analytics). Every type is exported so
 * TypeScript consumers get full intellisense; JavaScript consumers can ignore
 * them entirely.
 */

import type { AssetRef } from '@/common/assets';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (provided both as runtime objects and as string-literal unions)
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle state of a payment intent. */
export const PaymentIntentStatus = {
  Pending: 'PENDING',
  Submitted: 'SUBMITTED',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
  Cancelled: 'CANCELLED',
  Expired: 'EXPIRED',
} as const;
export type PaymentIntentStatus =
  (typeof PaymentIntentStatus)[keyof typeof PaymentIntentStatus];

/** SEP-7 operation a payment intent represents. */
export const PaymentIntentKind = {
  /** Source account is known → unsigned XDR + `web+stellar:tx` URI. */
  Tx: 'TX',
  /** No source → `web+stellar:pay` URI only (wallet picks the source). */
  Pay: 'PAY',
} as const;
export type PaymentIntentKind =
  (typeof PaymentIntentKind)[keyof typeof PaymentIntentKind];

/** Domain events an integrator can subscribe a webhook to. */
export const WebhookEventType = {
  PaymentIntentCreated: 'PAYMENT_INTENT_CREATED',
  PaymentIntentUpdated: 'PAYMENT_INTENT_UPDATED',
  PaymentIntentSucceeded: 'PAYMENT_INTENT_SUCCEEDED',
  PaymentIntentFailed: 'PAYMENT_INTENT_FAILED',
  PaymentIntentCancelled: 'PAYMENT_INTENT_CANCELLED',
  PaymentIntentDeleted: 'PAYMENT_INTENT_DELETED',
  // Fiat (BlindPay), re-emitted once the server syncs them.
  ReceiverUpdated: 'RECEIVER_UPDATED',
  PayinCreated: 'PAYIN_CREATED',
  PayinUpdated: 'PAYIN_UPDATED',
  PayinCompleted: 'PAYIN_COMPLETED',
  PayoutCreated: 'PAYOUT_CREATED',
  PayoutUpdated: 'PAYOUT_UPDATED',
  PayoutCompleted: 'PAYOUT_COMPLETED',
  // Same-chain swaps on every chain (Stellar, Solana, Monad).
  SwapCreated: 'SWAP_CREATED',
  SwapSubmitted: 'SWAP_SUBMITTED',
  SwapSucceeded: 'SWAP_SUCCEEDED',
  SwapFailed: 'SWAP_FAILED',
  SwapExpired: 'SWAP_EXPIRED',
  // Liquidity pool operations.
  LiquidityCreated: 'LIQUIDITY_CREATED',
  LiquiditySubmitted: 'LIQUIDITY_SUBMITTED',
  LiquiditySucceeded: 'LIQUIDITY_SUCCEEDED',
  LiquidityFailed: 'LIQUIDITY_FAILED',
  LiquidityExpired: 'LIQUIDITY_EXPIRED',
  // Cross-chain swaps (NEAR Intents).
  CrossChainSwapCreated: 'CROSS_CHAIN_SWAP_CREATED',
  CrossChainSwapUpdated: 'CROSS_CHAIN_SWAP_UPDATED',
  CrossChainSwapSucceeded: 'CROSS_CHAIN_SWAP_SUCCEEDED',
  CrossChainSwapRefunded: 'CROSS_CHAIN_SWAP_REFUNDED',
  CrossChainSwapFailed: 'CROSS_CHAIN_SWAP_FAILED',
  CrossChainSwapExpired: 'CROSS_CHAIN_SWAP_EXPIRED',
  // Private payments (client.privatePayments).
  PrivatePaymentSucceeded: 'ZK_PAYMENT_SUCCEEDED',
} as const;
export type WebhookEventType =
  (typeof WebhookEventType)[keyof typeof WebhookEventType];

/** Delivery state of a single webhook attempt. */
export const WebhookDeliveryStatus = {
  Pending: 'PENDING',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
} as const;
export type WebhookDeliveryStatus =
  (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

/** Product billing kind. */
export const ProductKind = {
  Recurring: 'recurring',
  OneTime: 'one_time',
  Link: 'link',
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];

/** Lifecycle state of a swap. */
export const SwapStatus = {
  Pending: 'PENDING',
  Submitted: 'SUBMITTED',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
  Expired: 'EXPIRED',
} as const;
export type SwapStatus = (typeof SwapStatus)[keyof typeof SwapStatus];

/** Which side of a pool an operation is on. */
export const LiquidityOperationKind = {
  Deposit: 'DEPOSIT',
  Withdraw: 'WITHDRAW',
} as const;
export type LiquidityOperationKind =
  (typeof LiquidityOperationKind)[keyof typeof LiquidityOperationKind];

/** Lifecycle state of a liquidity pool operation. */
export const LiquidityOperationStatus = {
  Pending: 'PENDING',
  Submitted: 'SUBMITTED',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
  Expired: 'EXPIRED',
} as const;
export type LiquidityOperationStatus =
  (typeof LiquidityOperationStatus)[keyof typeof LiquidityOperationStatus];

// ─────────────────────────────────────────────────────────────────────────────
// Payment intents
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /v1/payment-intents/tx`. */
export interface CreateTxPaymentIntentOptions {
  /** Payer's Stellar account — the transaction source. A registered address-book name also works. */
  source: string;
  /** Payee's Stellar account. A registered address-book name also works. */
  destination: string;
  /** Amount as a decimal string (max 7 decimals). */
  amount: string;
  /**
   * Typed asset (e.g. `Assets.USDC` or `defineAsset(...)`) — fills `assetCode`
   * and `assetIssuer` for you. Takes a back seat to explicit code/issuer below.
   */
  asset?: AssetRef;
  /** Asset code. Omit (or `XLM`/`native`) for native lumens. */
  assetCode?: string;
  /** Issuer account for a non-native asset. */
  assetIssuer?: string;
  /** MEMO_ID (numeric uint64) for idempotency + on-chain identification. Auto-generated when omitted. */
  memo?: string;
  /** SEP-7 `msg`: shown to the user in their wallet (≤ 300 chars). */
  msg?: string;
  /** SEP-7 `callback` where the wallet POSTs the signed XDR, e.g. `url:https://...`. */
  callback?: string;
}

/** Body for `POST /v1/payment-intents/pay`. */
/** The chain a payment intent settles on. */
export type PaymentChain = 'stellar' | 'solana' | 'monad';

export interface CreatePayPaymentIntentOptions {
  /**
   * Chain the payment settles on: `stellar` (the default, a SEP-7 `web+stellar:pay` link),
   * `solana` (a Solana Pay link) or `monad` (an EIP-681 link). The network (mainnet or test)
   * is the API key's, as on every route.
   */
  chain?: PaymentChain;
  /**
   * Payee's account on that chain: a Stellar `G...` account, a Solana address or a Monad
   * `0x...` address. A registered address-book name also works.
   */
  destination: string;
  /** Amount the destination should receive. Omit to let the user enter it (e.g. donations). */
  amount?: string;
  /**
   * Typed asset (e.g. `Assets.USDC` or `defineAsset(...)`) — fills `assetCode`
   * and `assetIssuer` for you. Takes a back seat to explicit code/issuer below.
   */
  asset?: AssetRef;
  /** Asset code the destination receives. Omit for the chain's coin (XLM, SOL or MON). */
  assetCode?: string;
  /** Who issues a token: the Stellar issuer account, the Solana SPL mint or the Monad ERC-20 contract. */
  assetIssuer?: string;
  /** MEMO_ID (numeric uint64) for idempotency + on-chain identification. Auto-generated when omitted. */
  memo?: string;
  /** Shown to the user in their wallet (≤ 300 chars): SEP-7 `msg` on Stellar, the Solana Pay `message`. */
  msg?: string;
  /** SEP-7 `callback`, e.g. `url:https://...`. Stellar only. */
  callback?: string;
}

/** Body for `PATCH /v1/payment-intents/:id`. */
export interface UpdatePaymentIntentOptions {
  status?: PaymentIntentStatus;
  /** Stellar transaction hash once the signed tx is submitted. */
  txHash?: string;
  /** Merchant reference. */
  reference?: string;
}

/** Query for `GET /v1/payment-intents`. */
export interface ListPaymentIntentsOptions {
  status?: PaymentIntentStatus;
  /** Only intents on this chain. Omit for every chain. */
  chain?: PaymentChain;
  /** Only intents created at or after this instant (a Date or an ISO 8601 string). */
  createdFrom?: Date | string;
  /** Page size (max 100, default 20). */
  take?: number;
  /** Offset (default 0). */
  skip?: number;
}

/** Raw payment intent payload returned by the API. */
export interface PaymentIntentData {
  id: string;
  kind: PaymentIntentKind;
  status: PaymentIntentStatus;
  /** Chain the payment settles on (TX intents are always Stellar). Older servers omit it: Stellar. */
  chain?: PaymentChain;
  network: string;
  source: string | null;
  destination: string;
  amount: string | null;
  asset: string;
  assetIssuer: string | null;
  memo: string;
  msg: string | null;
  callback: string | null;
  xdr: string | null;
  uri: string;
  qr: string;
  txHash: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of payment intents. */
export interface PaymentIntentListData {
  data: PaymentIntentData[];
  total: number;
  take: number;
  skip: number;
}

/** Body for `POST /v1/payment-intents/:id/validate`. */
export interface ValidatePaymentIntentOptions {
  /** Hash of the submitted Stellar transaction to validate against this intent. */
  txHash: string;
}

/** Raw outcome of a validation attempt. */
export interface ValidationOutcomeData {
  valid: boolean;
  status: PaymentIntentStatus;
  reason?: string | null;
  paymentIntent?: PaymentIntentData;
}

/** Raw `{ id, deleted }` response. */
export interface DeletedData {
  id: string;
  deleted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /v1/webhooks`. */
export interface CreateWebhookEndpointOptions {
  /** HTTPS URL that will receive POSTed event notifications. */
  url: string;
  description?: string;
  /** Event types to subscribe to. Omit/empty to receive all events. */
  eventTypes?: WebhookEventType[];
}

/** Body for `PATCH /v1/webhooks/:id`. */
export interface UpdateWebhookEndpointOptions {
  url?: string;
  description?: string;
  /** Pause/resume deliveries to this endpoint. */
  enabled?: boolean;
  eventTypes?: WebhookEventType[];
}

/** Raw webhook endpoint payload. */
export interface WebhookEndpointData {
  id: string;
  url: string;
  description: string | null;
  enabled: boolean;
  eventTypes: WebhookEventType[];
  createdAt: string;
  updatedAt: string;
}

/** Raw webhook endpoint payload including the one-time signing secret. */
export interface WebhookEndpointWithSecretData extends WebhookEndpointData {
  /** HMAC signing secret — shown once. Store it securely. */
  secret: string;
}

/** Raw result of a webhook ping. */
export interface WebhookPingData {
  ok: boolean;
  responseStatus: number | null;
  error: string | null;
}

/** Raw webhook delivery (audit) record. */
export interface WebhookDeliveryData {
  id: string;
  endpointId: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  lastAttemptAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of webhook deliveries. */
export interface WebhookDeliveryListData {
  data: WebhookDeliveryData[];
  total: number;
  take: number;
  skip: number;
}

/** Query for `GET /v1/webhooks/:id/deliveries`. */
export interface ListWebhookDeliveriesOptions {
  status?: WebhookDeliveryStatus;
  take?: number;
  skip?: number;
}

/** Shape of the JSON body POSTed to an integrator's webhook URL. */
export interface WebhookEvent<T = PaymentIntentData> {
  /** Stable event id (use for idempotency). */
  id: string;
  type: WebhookEventType;
  createdAt: string;
  data: T;
}

/** What each webhook event carries in `data`. */
export interface WebhookEventDataMap {
  PAYMENT_INTENT_CREATED: PaymentIntentData;
  PAYMENT_INTENT_UPDATED: PaymentIntentData;
  PAYMENT_INTENT_SUCCEEDED: PaymentIntentData;
  PAYMENT_INTENT_FAILED: PaymentIntentData;
  PAYMENT_INTENT_CANCELLED: PaymentIntentData;
  PAYMENT_INTENT_DELETED: PaymentIntentData;
  /** Identity and state only — ids, status, rails; never personal data. */
  RECEIVER_UPDATED: Record<string, unknown>;
  PAYIN_CREATED: Record<string, unknown>;
  PAYIN_UPDATED: Record<string, unknown>;
  PAYIN_COMPLETED: Record<string, unknown>;
  PAYOUT_CREATED: Record<string, unknown>;
  PAYOUT_UPDATED: Record<string, unknown>;
  PAYOUT_COMPLETED: Record<string, unknown>;
  /** A Stellar swap, or a Solana / Monad one (it carries `chain`). */
  SWAP_CREATED: SwapData | ChainSwapData;
  SWAP_SUBMITTED: SwapData | ChainSwapData;
  SWAP_SUCCEEDED: SwapData | ChainSwapData;
  SWAP_FAILED: SwapData | ChainSwapData;
  /** A swap that expired before its transaction settled (it may still be rescued if it lands). */
  SWAP_EXPIRED: SwapData | ChainSwapData;
  LIQUIDITY_CREATED: LiquidityOperationData;
  LIQUIDITY_SUBMITTED: LiquidityOperationData;
  LIQUIDITY_SUCCEEDED: LiquidityOperationData;
  LIQUIDITY_FAILED: LiquidityOperationData;
  /** A liquidity operation that expired before its transaction settled (a late landing can still settle it). */
  LIQUIDITY_EXPIRED: LiquidityOperationData;
  CROSS_CHAIN_SWAP_CREATED: CrossChainSwapData;
  CROSS_CHAIN_SWAP_UPDATED: CrossChainSwapData;
  CROSS_CHAIN_SWAP_SUCCEEDED: CrossChainSwapData;
  CROSS_CHAIN_SWAP_REFUNDED: CrossChainSwapData;
  CROSS_CHAIN_SWAP_FAILED: CrossChainSwapData;
  CROSS_CHAIN_SWAP_EXPIRED: CrossChainSwapData;
  /** A private payment the network settled (client.privatePayments). */
  ZK_PAYMENT_SUCCEEDED: PrivatePaymentData;
}

/** One webhook event of a known type, with `data` typed for it. */
export type TypedWebhookEvent<K extends keyof WebhookEventDataMap> = Omit<
  WebhookEvent<WebhookEventDataMap[K]>,
  'type'
> & { type: K };

/** Any webhook event — narrow on `type` to get `data` typed. */
export type AnyWebhookEvent = {
  [K in keyof WebhookEventDataMap]: TypedWebhookEvent<K>;
}[keyof WebhookEventDataMap];

// ─────────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /v1/products`. */
export interface CreateProductOptions {
  name: string;
  description?: string;
  /** Decimal price (≤ 7 decimals). Omit for a customer-set amount. */
  amount?: string;
  /** Asset code the price is in. Omit for native lumens (XLM). */
  assetCode?: string;
  kind?: ProductKind;
  active?: boolean;
  reference?: string;
}

/** Body for `PATCH /v1/products/:id`. */
export type UpdateProductOptions = Partial<CreateProductOptions>;

/** Raw product payload. */
export interface ProductData {
  id: string;
  name: string;
  description: string | null;
  amount: string | null;
  asset: string;
  kind: ProductKind;
  active: boolean;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────────────────────────────────────

/** The chains a customer's wallet can be on: the chains payments settle on. */
export type CustomerWalletChain = 'stellar' | 'solana' | 'monad';

/**
 * Body for `POST /v1/customers/:id/wallets`, and one entry of
 * {@link CreateCustomerOptions.wallets}: one wallet of a customer, the chain it
 * is on and its address there.
 */
export interface AddCustomerWalletOptions {
  /** The chain the wallet is on. */
  chain: CustomerWalletChain;
  /**
   * The address on that chain: a Stellar account (G..., checksum verified), a
   * Solana address (base58, 32 bytes) or a Monad address (0x + 40 hex, any case;
   * stored EIP-55 checksummed). Payment intents whose payer (`source`) is this
   * address count toward the customer.
   */
  address: string;
  /** A name for the wallet, shown beside the address. */
  label?: string;
}

/** Body for `POST /v1/customers`. */
export interface CreateCustomerOptions {
  name: string;
  alias?: string;
  note?: string;
  email?: string;
  /**
   * The customer's wallets, on any chain payments settle on, up to 20. Payment
   * intents paid from any of them count toward the customer. A wallet that
   * another of your customers already holds answers `409 customer_wallet_taken`.
   */
  wallets?: AddCustomerWalletOptions[];
  /**
   * @deprecated Use `wallets`. One wallet, its chain read from its shape (a
   * Stellar, Solana or Monad address); it is added to `wallets`.
   */
  account?: string;
  reference?: string;
}

/** Body for `PATCH /v1/customers/:id`. Wallets change through their own routes. */
export type UpdateCustomerOptions = Partial<Omit<CreateCustomerOptions, 'wallets'>>;

/** A wallet of a customer, on one chain, as the API returns it. */
export interface CustomerWalletData {
  /** Wallet id, used to remove it from the customer. */
  id: string;
  chain: CustomerWalletChain;
  /** The address, in its chain's stored spelling (EIP-55 on Monad). */
  address: string;
  /** A name for the wallet; null when none was given. */
  label?: string | null;
  /** When the wallet was added (ISO 8601). */
  createdAt: string;
}

/** Confirmation that a wallet was removed from a customer. */
export interface CustomerWalletDeletedData {
  /** Id of the removed wallet. */
  id: string;
  /** Always true. */
  deleted: boolean;
}

/**
 * Raw customer payload.
 *
 * There is no `consumerId`: the API stopped sending it, because the owning
 * consumer is the key that made the call and an internal id is not part of the
 * contract.
 */
export interface CustomerData {
  id: string;
  name: string;
  alias: string | null;
  note: string | null;
  email: string | null;
  /** The customer's wallets, oldest first, on any chain payments settle on. */
  wallets: CustomerWalletData[];
  /** @deprecated Read `wallets`. The first wallet's address; null without wallets. */
  account: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived on-chain stats (present in list responses). */
  payments?: number;
  succeeded?: number;
  total?: string;
}

/** Raw `{ data, total }` list of customers. */
export interface CustomerListData {
  data: CustomerData[];
  total: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsVolumeEntry {
  asset: string;
  amount: string;
  count: number;
}

export interface AnalyticsSeriesPoint {
  date: string;
  count: number;
  volume: string;
}

export interface AnalyticsRecentRow {
  id: string;
  kind: string;
  status: PaymentIntentStatus;
  amount: string | null;
  asset: string;
  destination: string;
  createdAt: string;
}

/** Raw overview metrics returned by `GET /v1/summary`. */
export interface AnalyticsSummaryData {
  totals: {
    all: number;
    succeeded: number;
    pending: number;
    submitted: number;
    failed: number;
    cancelled: number;
    expired: number;
    successRate: number;
  };
  volume: AnalyticsVolumeEntry[];
  webhooks: {
    endpoints: number;
    deliveries: number;
    failedDeliveries: number;
  };
  customers: number;
  series: AnalyticsSeriesPoint[];
  recent: AnalyticsRecentRow[];
}

export interface AnalyticsBalanceEntry {
  asset: string;
  amount: string;
  pending: string;
  count: number;
}

/** Raw balances returned by `GET /v1/balances`. */
export interface AnalyticsBalancesData {
  data: AnalyticsBalanceEntry[];
  total: number;
}

export interface ApiLogRow {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  status: 'ok' | 'pending' | 'fail';
  at: string;
}

/** Raw API request log returned by `GET /v1/logs`. */
export interface ApiLogsData {
  data: ApiLogRow[];
  total: number;
}

export interface WebhookLogRow {
  id: string;
  endpointId: string;
  url: string | null;
  eventType: WebhookEventType;
  eventId: string;
  attempts: number;
  responseStatus: number | null;
  error: string | null;
  status: 'ok' | 'pending' | 'fail';
  at: string;
}

/** Raw webhook delivery log returned by `GET /v1/logs/webhooks`. */
export interface WebhookLogsData {
  data: WebhookLogRow[];
  total: number;
}

/**
 * How `GET /v1/summary/series` groups its buckets (UTC, weeks from Monday):
 * `day` is 30 days, `week` 12 weeks, `month` 12 months and `year` 5 years.
 */
export type AnalyticsSeriesPeriod = 'day' | 'week' | 'month' | 'year';

/** Query for `GET /v1/summary/series`. */
export interface AnalyticsSeriesOptions {
  /** The bucket size; the server's default is `day`. */
  period?: AnalyticsSeriesPeriod;
}

/** Payment intents created in one bucket of the series. */
export interface AnalyticsSeriesBucket {
  /** The first day of the bucket (UTC; weeks start on Monday), e.g. `2026-10-01`. */
  start: string;
  /** Payments created in the bucket, any status. */
  count: number;
  /** Of those, the ones settled (status `SUCCEEDED`). */
  succeeded: number;
  /** Failed, cancelled or expired. */
  failed: number;
  /** Settled volume, every asset added, as a decimal string. */
  volume: string;
  /**
   * Settled volume in USD with two decimals, at NEAR Intents' current reference
   * price for each asset (indicative, today's price). Null only when the bucket
   * has settled payments and those prices could not be read.
   */
  volumeUsd: string | null;
}

/** Payment intent totals for a whole window of the series. */
export interface AnalyticsSeriesWindow {
  /** Payment intents created in the window, any status. */
  count: number;
  succeeded: number;
  /** Failed, cancelled or expired. */
  failed: number;
  /** Settled amount, every asset added, as a decimal string. */
  volume: string;
  /** Settled amount in USD (indicative); null when prices could not be read. */
  volumeUsd: string | null;
  /** Settled payments `volumeUsd` leaves out because their asset has no USD price. */
  unpriced: number;
}

/** {@link AnalyticsSeriesWindow} for the window the buckets cover, plus its distinct payers. */
export interface AnalyticsSeriesTotals extends AnalyticsSeriesWindow {
  /** Distinct paying accounts in the window. */
  payers: number;
}

/** Swaps or liquidity operations by outcome, for a bucket or a window. */
export interface AnalyticsSeriesOutcomeCounts {
  /** Created in the bucket or window, any status. */
  count: number;
  /** Of those, the ones that succeeded (for a USDT0 transfer, delivered). */
  succeeded: number;
  /** Given up on: failed or expired (and, for a cross-chain swap, refunded). */
  failed: number;
}

/** Swaps of every kind created in one bucket, with the USD value of the completed ones. */
export interface AnalyticsSeriesSwapBucket extends AnalyticsSeriesOutcomeCounts {
  /** The first day of the bucket, the same as the payments bucket at that index. */
  start: string;
  /** What the completed swaps sold, in USD (indicative); null when no price could be read. */
  volumeUsd: string | null;
}

/** A window's swaps split by kind, any status. */
export interface AnalyticsSeriesSwapsByKind {
  /** Stellar DEX swaps. */
  dex: number;
  /** Solana (Jupiter) and Monad (Kuru Flow) swaps. Mainnet only. */
  chain: number;
  /** Swaps between networks through NEAR Intents. Mainnet only. */
  crossChain: number;
  /** USDT0 sent from Stellar to an EVM network through LayerZero. Mainnet only. */
  usdt0: number;
}

/** Swap totals for the window the buckets cover. */
export interface AnalyticsSeriesSwapTotals extends AnalyticsSeriesOutcomeCounts {
  /** Not final yet: unsigned, submitted, or a cross-chain swap awaiting or processing its deposit. */
  inProgress: number;
  byKind: AnalyticsSeriesSwapsByKind;
  /** What the completed swaps sold, in USD (indicative); null when no price could be read. */
  volumeUsd: string | null;
  /** Completed swaps whose sold asset has no USD price, left out of `volumeUsd`. */
  unpriced: number;
}

/** Swap totals for the window of the same length just before the current one. */
export interface AnalyticsSeriesSwapPrevious extends AnalyticsSeriesOutcomeCounts {
  volumeUsd: string | null;
}

/**
 * Swaps of every kind (Stellar DEX, Solana and Monad, cross-chain, USDT0) on the
 * key's network. A sandbox key counts no Solana, Monad, cross-chain swap or USDT0
 * transfer, which run on mainnet only.
 */
export interface AnalyticsSeriesSwaps {
  buckets: AnalyticsSeriesSwapBucket[];
  totals: AnalyticsSeriesSwapTotals;
  previous: AnalyticsSeriesSwapPrevious;
}

/** Liquidity pool deposits and withdrawals created in one bucket. */
export interface AnalyticsSeriesLiquidityBucket extends AnalyticsSeriesOutcomeCounts {
  start: string;
}

/** Liquidity pool operations on the key's network. */
export interface AnalyticsSeriesLiquidity {
  buckets: AnalyticsSeriesLiquidityBucket[];
  totals: AnalyticsSeriesOutcomeCounts;
  previous: AnalyticsSeriesOutcomeCounts;
}

/** Webhook deliveries created in one bucket. */
export interface AnalyticsSeriesWebhookBucket {
  start: string;
  /** Deliveries created in the bucket, any status. */
  deliveries: number;
  /** Of those, the ones whose last attempt failed. */
  failed: number;
}

/** Webhook deliveries created in a window. */
export interface AnalyticsSeriesWebhookCounts {
  deliveries: number;
  failed: number;
}

/** Webhook deliveries to the consumer's endpoints (not scoped by network). */
export interface AnalyticsSeriesWebhooks {
  buckets: AnalyticsSeriesWebhookBucket[];
  totals: AnalyticsSeriesWebhookCounts;
  previous: AnalyticsSeriesWebhookCounts;
}

/** Private payments created in one bucket, amounts in XLM. */
export interface AnalyticsSeriesPrivatePaymentBucket {
  start: string;
  /** Private payments created in the bucket, any status. */
  count: number;
  /** Settled: both transfers confirmed. */
  succeeded: number;
  /** Past their deadline without settling. */
  expired: number;
  /** Settled amount in XLM, what the payers paid (the commission included). */
  volume: string;
  /** Settled amount in USD (indicative); null when prices could not be read. */
  volumeUsd: string | null;
}

/** Private payment totals for a window, amounts in XLM. */
export interface AnalyticsSeriesPrivatePaymentWindow {
  count: number;
  succeeded: number;
  expired: number;
  /** Settled amount in XLM, the commission included. */
  volume: string;
  volumeUsd: string | null;
  /** Commission the settled payments paid to Cosmos Pay, in XLM (0.18% of each). */
  fees: string;
  /** The commission in USD (indicative); null when prices could not be read. */
  feesUsd: string | null;
}

/**
 * Private payments on the key's network. They run on testnet only for now, so a
 * production key counts none.
 */
export interface AnalyticsSeriesPrivatePayments {
  buckets: AnalyticsSeriesPrivatePaymentBucket[];
  totals: AnalyticsSeriesPrivatePaymentWindow;
  previous: AnalyticsSeriesPrivatePaymentWindow;
}

/**
 * Raw activity series returned by `GET /v1/summary/series`: payments, swaps,
 * liquidity operations, webhook deliveries and private payments, each grouped
 * into the UTC buckets of `period`, with the totals of the window and of the
 * window before (for growth). Every `buckets` array is oldest first and
 * pre-seeded, so a quiet bucket is a zero.
 */
export interface AnalyticsSeriesData {
  /** How the buckets are grouped, as requested (`day` when omitted). */
  period: AnalyticsSeriesPeriod;
  /** Payment intents per bucket. */
  buckets: AnalyticsSeriesBucket[];
  /** Payment intent totals for the window the buckets cover. */
  totals: AnalyticsSeriesTotals;
  /** The window of the same length just before it. */
  previous: AnalyticsSeriesWindow;
  swaps: AnalyticsSeriesSwaps;
  liquidity: AnalyticsSeriesLiquidity;
  webhooks: AnalyticsSeriesWebhooks;
  /** Private payments (the API names this field after its `/v1/zk-payments` route). */
  zkPayments: AnalyticsSeriesPrivatePayments;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthCheckData {
  status: string;
  info?: Record<string, { status: string } & Record<string, unknown>> | null;
  error?: Record<string, { status: string } & Record<string, unknown>> | null;
  details?: Record<string, { status: string } & Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Swaps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The chain a same-chain swap runs on. `stellar` (the default when omitted) is
 * the Stellar DEX; `solana` goes through Jupiter and `monad` through Kuru Flow,
 * both mainnet only.
 */
export type SwapChain = 'stellar' | 'solana' | 'monad';

/** The chains off Stellar, whose swaps come back as a {@link ChainSwapData}. */
export type OtherSwapChain = Exclude<SwapChain, 'stellar'>;

/** Body for `POST /v1/swaps/quote` (pricing only; no fee parameter — the fee is enforced server-side per organization). */
export interface QuoteSwapOptions {
  /** Which chain to swap on. Omitted means Stellar. */
  chain?: SwapChain;
  /** Amount to send, as a decimal string in the asset's own units (max 7 decimals on Stellar). */
  amount: string;
  /**
   * Stellar: asset code (omit, `XLM` or `native` for lumens). Solana / Monad:
   * `SOL` / `MON`, `native`, or the SPL mint / ERC-20 address.
   */
  sourceAssetCode?: string;
  /** Stellar only: issuer account for a non-native source asset. */
  sourceAssetIssuer?: string;
  /** The asset the swap should deliver, spelled as for `sourceAssetCode`. */
  destAssetCode: string;
  /** Stellar only: issuer account for a non-native destination asset. */
  destAssetIssuer?: string;
  /** Allowed slippage in basis points. */
  slippageBps?: number;
}

/** Body for `POST /v1/swaps`. */
export interface CreateSwapOptions extends QuoteSwapOptions {
  /** Source account performing (and signing) the swap, on `chain`. A registered address-book name also works on Stellar. */
  source: string;
  /** Stellar only: account that receives the swapped asset. Defaults to the source. */
  destination?: string;
  /** Stellar only: MEMO_ID (numeric uint64) for idempotency + on-chain identification. */
  memo?: string;
  /** Idempotency key (the `Idempotency-Key` header is preferred when both are set). */
  idempotencyKey?: string;
}

/**
 * Body for `POST /v1/swaps/:id/submit`: `signedXdr` for a Stellar swap,
 * `signedTransaction` for a Solana or Monad one.
 */
export type SubmitSwapOptions =
  | {
      /** Signed transaction envelope (base64 XDR) to relay to the Stellar network. */
      signedXdr: string;
      signedTransaction?: never;
    }
  | {
      /**
       * Solana: base64 wire bytes of the signed VersionedTransaction. Monad: the
       * `0x`-hex raw signed EIP-1559 transaction.
       */
      signedTransaction: string;
      signedXdr?: never;
    };

/** Query for `GET /v1/swaps`. */
export interface ListSwapsOptions {
  /** Which chain to list. Omitted means Stellar. */
  chain?: SwapChain;
  status?: SwapStatus;
  /** Page size (max 100, default 20). */
  take?: number;
  /** Offset (default 0). */
  skip?: number;
}

/** Raw swap payload returned by the API. */
export interface SwapData {
  id: string;
  status: SwapStatus;
  network: string;
  source: string;
  destination: string;
  sendAsset: string;
  sendAssetIssuer: string | null;
  sendAmount: string;
  feeAmount: string;
  feeBps: number;
  swapAmount: string;
  destAsset: string;
  destAssetIssuer: string | null;
  destEstimated: string;
  destMin: string;
  slippageBps: number;
  path: { code: string; issuer: string | null }[];
  memo: string | null;
  xdr: string;
  uri: string;
  txHash: string;
  qr: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of swaps. */
export interface SwapListData {
  data: SwapData[];
  total: number;
  take: number;
  skip: number;
}

/** Raw pricing quote returned by `POST /v1/swaps/quote`. */
export interface SwapQuoteData {
  network: string;
  /** Solana and Monad quotes only. */
  chain?: OtherSwapChain;
  /** The aggregator that priced a Solana or Monad swap. */
  provider?: 'jupiter' | 'kuru';
  source: { asset: string; issuer: string | null; amount: string };
  /** Stellar takes the fee from the source asset; Solana and Monad from the output (`asset` says which). */
  fee: { asset: string; issuer: string | null; amount: string; bps: number; wallet: string | null };
  swap: { asset: string; issuer: string | null; amount: string };
  destination: {
    asset: string;
    issuer: string | null;
    estimated: string;
    minimum: string;
    slippageBps: number;
  };
  path: { code: string; issuer: string | null }[];
}

/** Raw outcome of relaying a signed swap transaction. */
export interface SwapSubmitOutcomeData {
  submitted: boolean;
  status: SwapStatus;
  txHash?: string;
  reason?: string;
  resultCodes?: string[];
  swap: SwapData;
}

/**
 * What a Solana or Monad swap's wallet signs. Solana: an unsigned
 * VersionedTransaction; Monad: a call the wallet signs as an EIP-1559
 * transaction, filling in nonce and gas itself.
 */
export type ChainSwapTransaction =
  | { encoding: 'base64'; data: string; lastValidBlockHeight?: number }
  | { to: string; data: string; value: string; chainId: number };

/** An EVM call the wallet sends itself (a Monad ERC-20 `approve`). */
export interface EvmCallData {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

/** Raw Solana or Monad swap (`chain_swap`), built by Jupiter or Kuru Flow. */
export interface ChainSwapData {
  id: string;
  chain: OtherSwapChain;
  /** Always `public`: the aggregators run on mainnet only. */
  network: string;
  provider: 'jupiter' | 'kuru';
  status: SwapStatus;
  /** The wallet that signs, pays and receives. */
  source: string;
  /** `native` (SOL / MON), or the SPL mint / ERC-20 address. */
  sendAsset: string;
  sendAmount: string;
  destAsset: string;
  /** Quoted output, net of the commission. */
  destEstimated: string;
  /** On-chain minimum after slippage. */
  destMin: string;
  feeBps: number;
  /** The commission, in the destination asset (taken from the output). */
  feeAmount: string;
  slippageBps: number;
  path: { code: string; issuer: string | null }[];
  transaction: ChainSwapTransaction;
  /** Monad, selling an ERC-20 with too small an allowance: send and confirm this first. */
  approval: EvmCallData | null;
  /** The Solana signature / EVM hash, once submitted. */
  txHash: string | null;
  idempotencyKey: string | null;
  /** Submit refuses the transaction after this; build a new swap. */
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of Solana or Monad swaps. */
export interface ChainSwapListData {
  data: ChainSwapData[];
  total: number;
  take: number;
  skip: number;
}

/** Raw outcome of relaying a signed Solana or Monad swap. */
export interface ChainSwapSubmitOutcomeData {
  submitted: boolean;
  status: SwapStatus;
  txHash: string;
  swap: ChainSwapData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-chain swaps (NEAR Intents)
// ─────────────────────────────────────────────────────────────────────────────

/** Where a cross-chain swap stands. SUCCEEDED, REFUNDED and FAILED are final. */
export const CrossChainSwapStatus = {
  AwaitingDeposit: 'AWAITING_DEPOSIT',
  DepositDetected: 'DEPOSIT_DETECTED',
  IncompleteDeposit: 'INCOMPLETE_DEPOSIT',
  Processing: 'PROCESSING',
  Succeeded: 'SUCCEEDED',
  Refunded: 'REFUNDED',
  Failed: 'FAILED',
  Expired: 'EXPIRED',
} as const;
export type CrossChainSwapStatus =
  (typeof CrossChainSwapStatus)[keyof typeof CrossChainSwapStatus];

/** A token NEAR Intents can swap on one of the supported chains. */
export interface CrossChainAssetData {
  chain: SwapChain;
  symbol: string;
  /** NEAR Intents' id for the asset. */
  assetId: string;
  decimals: number;
  /** SPL mint, ERC-20 address or Stellar issuer; null for the native coin. */
  contract: string | null;
}

/**
 * Body for `POST /v1/cross-chain-swaps/quote`. Both legs on one chain is not a
 * cross-chain swap — use `client.swaps` with `chain`.
 */
export interface QuoteCrossChainSwapOptions {
  originChain: SwapChain;
  /** Native ticker, a symbol listed once, a contract, or Stellar `CODE:ISSUER`. */
  originAsset: string;
  destinationChain: SwapChain;
  destinationAsset: string;
  /** Gross amount of the origin asset, in its own units. */
  amount: string;
  /** Who receives the output, on `destinationChain`. */
  recipient: string;
  /** Where a failed or late deposit is refunded, on `originChain`. */
  refundTo: string;
  slippageBps?: number;
}

/** Body for `POST /v1/cross-chain-swaps`. */
export interface CreateCrossChainSwapOptions extends QuoteCrossChainSwapOptions {
  idempotencyKey?: string;
}

/** Raw cross-chain quote. */
export interface CrossChainQuoteData {
  network: string;
  origin: {
    chain: SwapChain;
    asset: string;
    assetId: string;
    contract: string | null;
    amount: string;
    amountUsd: string | null;
  };
  destination: {
    chain: SwapChain;
    asset: string;
    assetId: string;
    contract: string | null;
    amount: string;
    amountUsd: string | null;
    /** Below this NEAR Intents refunds instead of filling. */
    minimum: string;
  };
  /** The plan commission, taken by NEAR Intents out of the input. */
  fee: { bps: number; amount: string; asset: string };
  slippageBps: number;
  timeEstimateSeconds: number;
}

/** A settlement transaction NEAR Intents reports. */
export interface CrossChainTransactionData {
  hash: string;
  explorerUrl: string;
}

/** Raw cross-chain swap. */
export interface CrossChainSwapData {
  id: string;
  status: CrossChainSwapStatus;
  /** NEAR Intents' own status word, verbatim. */
  providerStatus: string;
  network: string;
  originChain: SwapChain;
  originAsset: string;
  originContract: string | null;
  destinationChain: SwapChain;
  destinationAsset: string;
  destinationContract: string | null;
  amountIn: string;
  feeBps: number;
  feeAmount: string;
  amountOutEstimated: string;
  amountOutMin: string;
  slippageBps: number;
  recipient: string;
  refundTo: string;
  /** Send exactly `amountIn` of the origin asset here. */
  depositAddress: string;
  /** Stellar only, and required: attach it as a MEMO_TEXT. */
  depositMemo: string | null;
  /** The deposit as a wallet link: SEP-7 pay, Solana Pay or EIP-681. */
  depositUri: string;
  /** QR of `depositUri` (PNG data URL); absent from list rows. */
  qr?: string;
  depositTxHash: string | null;
  amountOut: string | null;
  refundedAmount: string | null;
  originTxHashes: CrossChainTransactionData[] | null;
  destinationTxHashes: CrossChainTransactionData[] | null;
  timeEstimateSeconds: number;
  correlationId: string;
  /** NEAR Intents' signature over the quote and deposit address — keep it. */
  quoteSignature: string;
  idempotencyKey: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Query for `GET /v1/cross-chain-swaps`. */
export interface ListCrossChainSwapsOptions {
  status?: CrossChainSwapStatus;
  take?: number;
  skip?: number;
}

/** Raw paginated list of cross-chain swaps. */
export interface CrossChainSwapListData {
  data: CrossChainSwapData[];
  total: number;
  take: number;
  skip: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Liquidity pools
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /v1/liquidity-pools/deposit`. */
export interface DepositLiquidityOptions {
  /** Account whose funds go in, and which signs. An address-book name also works. */
  source: string;
  /** Asset A code. Omit (or `XLM`/`native`) for native lumens. */
  assetACode?: string;
  /** Issuer for a non-native asset A. */
  assetAIssuer?: string;
  /** Asset B code. */
  assetBCode?: string;
  /** Issuer for a non-native asset B. */
  assetBIssuer?: string;
  /** Ceiling on how much of asset A may go in, as a decimal string. */
  maxAmountA: string;
  /** Ceiling on how much of asset B may go in. */
  maxAmountB: string;
  /** Allowed price movement in basis points. */
  slippageBps?: number;
  /** MEMO_ID (numeric uint64) for on-chain identification. */
  memo?: string;
  /**
   * Idempotency token. Sent both as the body field and as the `Idempotency-Key`
   * header, which is what makes a retried deposit return the FIRST operation
   * instead of building a second one against the same funds.
   */
  idempotencyKey?: string;
}

/** Body for `POST /v1/liquidity-pools/withdraw`. */
export interface WithdrawLiquidityOptions {
  /** Account holding the shares, and which signs. */
  source: string;
  /** The pool to withdraw from (hex id). */
  poolId: string;
  /** Pool shares to burn, as a decimal string. */
  shares: string;
  /** Allowed price movement in basis points. */
  slippageBps?: number;
  memo?: string;
  /** See {@link DepositLiquidityOptions.idempotencyKey}. */
  idempotencyKey?: string;
}

/** Body for `POST /v1/liquidity-pools/operations/:id/submit`. */
export interface SubmitLiquidityOptions {
  /** Signed transaction envelope (base64 XDR) to relay to the network. */
  signedXdr: string;
}

/** Query for `GET /v1/liquidity-pools/operations`. */
export interface ListLiquidityOperationsOptions {
  kind?: LiquidityOperationKind;
  status?: LiquidityOperationStatus;
  /** Page size (max 100, default 20). */
  take?: number;
  /** Offset (default 0). */
  skip?: number;
}

/** Query for `GET /v1/liquidity-pools` (Horizon proxy). */
export interface BrowseLiquidityPoolsOptions {
  assetACode?: string;
  assetAIssuer?: string;
  assetBCode?: string;
  assetBIssuer?: string;
  /** Only pools this account holds shares in. */
  account?: string;
  /** Horizon paging cursor from a previous page. */
  cursor?: string;
  limit?: number;
}

/** One side of a pool's reserves. */
export interface LiquidityReserveData {
  asset: string;
  issuer: string | null;
  amount: string;
}

/** Raw on-chain pool payload (Horizon proxy). */
export interface LiquidityPoolData {
  id: string;
  network: string;
  /** Pool fee in basis points — 30 for every constant-product pool today. */
  feeBp: number;
  totalTrustlines: string;
  totalShares: string;
  reserves: LiquidityReserveData[];
}

/** Raw cursor-paginated list of pools. */
export interface LiquidityPoolListData {
  data: LiquidityPoolData[];
  cursor?: string | null;
}

/** One account's stake in one pool. */
export interface LiquidityPositionData {
  poolId: string;
  /** Shares this account holds. */
  shares: string;
  /** Shares in existence. */
  totalShares: string;
  /** The account's share of the pool, in basis points. */
  shareOfPoolBps: number;
  reserves: LiquidityReserveData[];
  /** What those shares would redeem for right now. */
  redeemable: LiquidityReserveData[];
}

/** Raw payload of `GET /v1/liquidity-pools/positions`. */
export interface LiquidityPositionsData {
  account: string;
  network: string;
  data: LiquidityPositionData[];
}

/** Raw liquidity operation payload returned by the API. */
export interface LiquidityOperationData {
  id: string;
  kind: LiquidityOperationKind;
  status: LiquidityOperationStatus;
  network: string;
  source: string;
  poolId: string;
  assetA: string;
  assetAIssuer: string | null;
  assetB: string;
  assetBIssuer: string | null;
  amountA: string;
  amountB: string;
  shares: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  slippageBps: number;
  idempotencyKey: string | null;
  feeBps: number;
  feeAmountA: string;
  feeAmountB: string;
  feeWallet: string | null;
  commissionMemo: string | null;
  xdr: string;
  uri: string;
  txHash: string;
  qr: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of liquidity operations. */
export interface LiquidityOperationListData {
  data: LiquidityOperationData[];
  total: number;
  take: number;
  skip: number;
}

/** Raw outcome of relaying a signed liquidity transaction. */
export interface LiquiditySubmitOutcomeData {
  submitted: boolean;
  status: LiquidityOperationStatus;
  txHash?: string;
  reason?: string;
  resultCodes?: string[];
  operation: LiquidityOperationData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity (client event stream)
// ─────────────────────────────────────────────────────────────────────────────

/** Where an event came from. */
export type ActivitySource = 'wallet' | 'dashboard' | 'server' | 'sdk';

/** Severity of an event. */
export type ActivityLevel = 'debug' | 'info' | 'warn' | 'error';

/** One event to report. Always batched — see {@link ReportActivityOptions}. */
export interface ActivityEventInput {
  /** Dotted event name, e.g. `payment.submitted`. */
  type: string;
  /**
   * Client-generated id. The service de-duplicates on it, which is what makes a
   * retried batch safe: the second delivery is counted as a duplicate rather than
   * stored twice.
   */
  eventId?: string;
  source?: ActivitySource;
  level?: ActivityLevel;
  category?: string;
  message?: string;
  sessionId?: string;
  distinctId?: string;
  appVersion?: string;
  platform?: string;
  network?: string;
  durationMs?: number;
  /** Free-form properties. Never put secrets or memo text here. */
  props?: Record<string, unknown>;
  /** When it happened (ISO-8601). Defaults to arrival time. */
  occurredAt?: string;
}

/** Body for `POST /v1/activity/events`. */
export interface ReportActivityOptions {
  events: ActivityEventInput[];
}

/** Raw outcome of a reported batch. */
export interface ActivityReportData {
  accepted: number;
  /** Events whose `eventId` had already been stored. */
  duplicates: number;
}

/** Query for `GET /v1/activity/events`. */
export interface ListActivityOptions {
  take?: number;
  skip?: number;
  source?: ActivitySource;
  level?: ActivityLevel;
  category?: string;
  type?: string;
  network?: string;
  /** ISO-8601 lower bound (inclusive). */
  since?: string;
  /** ISO-8601 upper bound (exclusive). */
  until?: string;
}

/** One stored event. */
export interface ActivityEventData {
  id: string;
  source: string;
  level: string;
  category: string;
  type: string;
  message: string | null;
  sessionId: string | null;
  distinctId: string | null;
  appVersion: string | null;
  platform: string | null;
  network: string | null;
  durationMs: number | null;
  props: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  /** When it happened. */
  at: string;
  /** When the service stored it. */
  receivedAt: string;
}

/** Raw paginated list of events. */
export interface ActivityListData {
  data: ActivityEventData[];
  total: number;
  take: number;
  skip: number;
}

/** One `{ key, count }` bucket of an activity summary. */
export interface ActivityBucket {
  key: string;
  count: number;
}

/** Raw payload of `GET /v1/activity/summary`. */
export interface ActivitySummaryData {
  total: number;
  sessions: number;
  devices: number;
  levels: ActivityBucket[];
  sources: ActivityBucket[];
  categories: ActivityBucket[];
  topTypes: ActivityBucket[];
  topErrors: ActivityBucket[];
  series: { date: string; count: number; errors: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// On-ramp (fiat -> stablecoin)
// ─────────────────────────────────────────────────────────────────────────────

/** Stablecoins the ramps settle in. */
export type RampToken = 'USDC' | 'USDT' | 'USDB';

/** Which side of a quote the requested amount refers to. */
export type CurrencyType = 'sender' | 'receiver';

/** Fiat rails a payin can arrive over. */
export type PayinMethod =
  | 'ach'
  | 'wire'
  | 'pix'
  | 'ted'
  | 'spei'
  | 'transfers'
  | 'pse'
  | 'international_swift'
  | 'rtp';

/** Payer restrictions, for the rails that require them. */
export interface PayinPayerRules {
  pix_allowed_tax_ids?: string[];
  transfers_allowed_tax_id?: string;
  pse_allowed_tax_ids?: string[];
  pse_full_name?: string;
  pse_document_type?: string;
  pse_document_number?: string;
  pse_email?: string;
  pse_phone?: string;
  pse_bank_code?: string;
}

/**
 * Body for `POST /v1/onramp/quotes`.
 *
 * The field names are snake_case because they are the RAMP PROVIDER's, and the
 * service passes them through unchanged. Renaming them here would look tidier and
 * would put a translation layer between two systems that already agree.
 */
export interface CreatePayinQuoteOptions {
  /** Wallet that receives the converted stablecoin. */
  blockchain_wallet_id: string;
  currency_type: CurrencyType;
  payment_method: PayinMethod;
  token: RampToken;
  /** Amount in MINOR units (e.g. cents). */
  request_amount: number;
  cover_fees?: boolean;
  payer_rules?: PayinPayerRules;
  is_otc?: boolean;
  partner_fee_id?: string;
  wallet_id?: string;
}

/** Raw payin quote. Expires quickly — read `expires_at` before acting on it. */
export interface PayinQuoteData {
  id: string;
  /** Unix seconds (~5 minutes out). */
  expires_at: number;
  commercial_quotation?: number;
  receiver_amount?: number;
  sender_amount?: number;
}

/** Body for `POST /v1/onramp/payins`. */
export interface CreatePayinOptions {
  payin_quote_id: string;
}

/** Query for `GET /v1/onramp/payins`. */
export interface ListPayinsOptions {
  take?: number;
  skip?: number;
}

/**
 * Raw payin. The scalar fields are mirrored locally; `instructions` is passed
 * through from the provider verbatim (memo / CLABE / PIX code / CBU / PSE link…),
 * so its shape depends on `paymentMethod` and is deliberately not narrowed here.
 */
export interface PayinData {
  id: string;
  blindpayId: string;
  status: string | null;
  token: string | null;
  network: string | null;
  paymentMethod: string | null;
  /** Minor units, as a decimal string. */
  senderAmount: string | null;
  receiverAmount: string | null;
  instructions: unknown;
  createdAt: string;
}

/** Raw paginated list of payins. */
export interface PayinListData {
  data: PayinData[];
  total: number;
  take: number;
  skip: number;
}

/** Body for `POST /v1/onramp/trustline`. */
export interface CreateTrustlineOptions {
  /** Stellar address that needs the asset trustline. */
  address: string;
}

/**
 * Raw trustline response — a provider passthrough, which is why it is an open
 * shape. It carries the unsigned envelope the customer signs; a wallet reads `xdr`
 * off it and must put that through its own signing guard before signing.
 */
export interface TrustlineData {
  xdr?: string;
  [key: string]: unknown;
}

/** Banking partners a virtual account can be opened with. */
export type BankingPartner = 'jpmorgan' | 'citi' | 'hsbc' | 'cfsb';

/** Body for `POST /v1/onramp/receivers/:receiverId/virtual-accounts`. */
export interface CreateVirtualAccountOptions {
  banking_partner: BankingPartner;
  token: RampToken;
  /** Cosmos Pay wallet id that receives the converted stablecoin. */
  blockchain_wallet_id: string;
  signed_agreement_id?: string;
  sole_proprietor_doc_type?: string;
  sole_proprietor_doc_file?: string;
}

/** Raw virtual account — a provider passthrough. */
export type VirtualAccountData = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Off-ramp (stablecoin -> fiat)
// ─────────────────────────────────────────────────────────────────────────────

/** Chains a payout can be funded from. */
export type PayoutNetwork =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'stellar'
  | 'solana'
  | 'tron'
  | 'sepolia'
  | 'base_sepolia'
  | 'arbitrum_sepolia'
  | 'polygon_amoy'
  | 'stellar_testnet'
  | 'solana_devnet';

/** Chain families the authorize / create steps distinguish. */
export type PayoutChain = 'evm' | 'stellar' | 'solana';

/** Body for `POST /v1/offramp/quotes`. */
export interface CreatePayoutQuoteOptions {
  /** Destination bank account, belonging to a verified receiver. */
  bank_account_id: string;
  currency_type: CurrencyType;
  cover_fees?: boolean;
  /** Amount in MINOR units. */
  request_amount: number;
  network: PayoutNetwork;
  token: RampToken;
  description?: string;
  partner_fee_id?: string;
}

/** Raw payout quote. */
export interface PayoutQuoteData {
  id: string;
  /** Unix seconds (~5 minutes out). */
  expires_at: number;
  sender_amount?: number;
  /** Local fiat amount to receive, in minor units. */
  receiver_amount?: number;
  receiver_local_amount?: number;
  /** EVM `approve` payload to sign (abi, address, functionName, amount). */
  contract?: unknown;
}

/** Body for `POST /v1/offramp/payouts/authorize`. */
export interface AuthorizePayoutOptions {
  quote_id: string;
  sender_wallet_address: string;
  /** Only the chains that need an unsigned transaction built for them. */
  chain: 'stellar' | 'solana';
}

/**
 * Raw authorize response — the unsigned transaction, passed through from the
 * provider. Its `xdr` (Stellar) is what a wallet must bound against the quote the
 * user actually confirmed before signing it.
 */
export interface AuthorizePayoutData {
  xdr?: string;
  [key: string]: unknown;
}

/** Body for `POST /v1/offramp/payouts`. */
export interface CreatePayoutOptions {
  quote_id: string;
  sender_wallet_address: string;
  chain: PayoutChain;
  /** The signed transaction produced from `authorize` (or the EVM approval). */
  signed_transaction?: string;
}

/** Query for `GET /v1/offramp/payouts`. */
export interface ListPayoutsOptions {
  take?: number;
  skip?: number;
}

/** Raw payout. Same mirroring rules as {@link PayinData}. */
export interface PayoutData {
  id: string;
  blindpayId: string;
  status: string | null;
  token: string | null;
  network: string | null;
  /** Fiat rail the money lands on. */
  rail: string | null;
  senderAmount: string | null;
  receiverAmount: string | null;
  senderWalletAddress: string | null;
  createdAt: string;
}

/** Raw paginated list of payouts. */
export interface PayoutListData {
  data: PayoutData[];
  total: number;
  take: number;
  skip: number;
}

/** Body for `POST /v1/offramp/payouts/:id/documents`. */
export interface AttachPayoutDocumentOptions {
  transaction_document_type?: string;
  transaction_document_id?: string;
  /** Base64 (or data URL) of the document itself. */
  transaction_document_file?: string;
  description?: string;
}

/** Raw document response — a provider passthrough. */
export type PayoutDocumentData = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// KYC / KYB (receivers, wallets, bank accounts)
// ─────────────────────────────────────────────────────────────────────────────

/** A receiver is a person or a company. */
export type ReceiverType = 'individual' | 'business';

/** How deep the verification goes. */
export type KycType = 'light' | 'standard' | 'enhanced';

/** One beneficial owner of a business receiver. */
export interface ReceiverOwner {
  role?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  tax_id?: string;
  country?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province_region?: string;
  postal_code?: string;
  /** Ownership percentage. */
  ownership_percentage?: number;
  title?: string;
  id_doc_country?: string;
  id_doc_type?: string;
  /** `file_url` from `POST /v1/kyc/upload`. */
  id_doc_front_file?: string;
  id_doc_back_file?: string;
  proof_of_address_doc_type?: string;
  /** `file_url` from `POST /v1/kyc/upload`. */
  proof_of_address_doc_file?: string;
  /** The owner's tax id type. */
  tax_type?: string;
}

/**
 * Body for `POST /v1/kyc/receivers`.
 *
 * Every `*_file` field takes a `file_url` returned by {@link KycManager.upload} —
 * not the bytes. Upload first, then create the receiver with the URLs.
 */
export interface CreateReceiverOptions {
  type: ReceiverType;
  kyc_type: KycType;
  email: string;
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  first_name?: string;
  last_name?: string;
  /** ISO-8601 datetime. A date-only value is rejected upstream. */
  date_of_birth?: string;
  tax_id?: string;
  occupation?: string;
  id_doc_country?: string;
  id_doc_type?: string;
  /** `file_url` from `POST /v1/kyc/upload`. */
  id_doc_front_file?: string;
  id_doc_back_file?: string;
  selfie_file?: string;
  account_purpose?: string;
  account_purpose_other?: string;
  source_of_funds_doc_type?: string;
  source_of_funds_doc_file?: string;
  source_of_wealth?: string;
  /** `master_service_agreement` | `salary_slip` | `bank_statement`. */
  sole_proprietor_doc_type?: string;
  proof_of_address_doc_type?: string;
  proof_of_address_doc_file?: string;
  recipient_relationship?: string;
  purpose_of_transactions?: string;
  purpose_of_transactions_explanation?: string;
  legal_name?: string;
  alternate_name?: string;
  business_type?: string;
  business_industry?: string;
  business_description?: string;
  formation_date?: string;
  estimated_annual_revenue?: string;
  publicly_traded?: boolean;
  website?: string;
  incorporation_doc_file?: string;
  proof_of_ownership_doc_file?: string;
  owners?: ReceiverOwner[];
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province_region?: string;
  postal_code?: string;
  phone_number?: string;
  ip_address?: string;
  /** Your own id for this receiver. */
  external_id?: string;
  image_url?: string;
  /**
   * Accepted terms-of-service id, from the redirect of
   * {@link KycManager.termsOfService}. The provider requires it to create a
   * receiver, which is why ToS is the FIRST step of the flow rather than the last.
   */
  tos_id?: string;
}

/**
 * Body for `PATCH /v1/kyc/receivers/:id` — the same fields, all optional.
 *
 * Identity is reviewed before it reaches the provider, edits included. Until the
 * receiver is enabled, an edit that touches KYC data sends it back to
 * `pending_review`. Once it exists at the provider, a tenant key may change only
 * `external_id` and `image_url`; any other field is `403 kyc_review_required` unless
 * the key is elevated (`X-Consumer-Role: admin`), because that edit rewrites the
 * identity at the provider directly.
 */
export type UpdateReceiverOptions = Partial<CreateReceiverOptions>;

/** Body for `POST /v1/kyc/receivers/:id/approve`. */
export interface ApproveReceiverOptions {
  redirect_url?: string;
  /**
   * The {@link ReceiverData.dossierVersion} this approval is for.
   *
   * Approving is a statement about KYC data someone read and accepted, and the
   * tenant can edit that data in between: an edit leaves the receiver in
   * `pending_review`, so without a version the approval lands on whatever is
   * stored when the request arrives and nobody can tell. Send it and a dossier
   * that moved on is a `409 kyc_state_invalid` — re-read, review again, approve
   * that version.
   *
   * {@link Receiver.approve} fills this in from the instance; omit it there only
   * if you mean "approve whatever is stored now".
   */
  expected_version?: number;
}

/** Body for `POST /v1/kyc/receivers/:id/tos`. */
export interface RequestTosOptions {
  /** `code` returns the URL to show; `email` sends it to the receiver. */
  channel: 'code' | 'email';
  redirect_url?: string;
}

/** Body for `POST /v1/kyc/receivers/:id/enable`. */
export interface EnableReceiverOptions {
  /** An accepted terms-of-service id. */
  tos_id: string;
}

/** Body for `PATCH /v1/kyc/receivers/:id/access`. */
export interface SetReceiverAccessOptions {
  /** `true` cuts this receiver off from both ramps — an admin kill switch. */
  disabled: boolean;
}

/** Query for the paginated KYC collections. */
export interface ListKycOptions {
  take?: number;
  skip?: number;
}

/** Raw receiver payload. `kycStatus` is refreshed from the provider on read. */
export interface ReceiverData {
  id: string;
  blindpayId: string;
  type: string;
  kycType: string | null;
  kycStatus: string | null;
  email: string | null;
  name: string | null;
  country: string | null;
  externalId: string | null;
  /** True when the receiver is cut off from the ramps. */
  disabled: boolean;
  /**
   * How many times the submitted KYC data has been written. Send it back as
   * `expected_version` when approving, so the approval cannot land on a dossier
   * nobody read.
   */
  dossierVersion: number;
  /**
   * The `dossierVersion` a reviewer approved, or null while unapproved. The
   * receiver cannot be enabled until it equals {@link ReceiverData.dossierVersion}
   * again, so an edit after approval sends it back through review.
   */
  reviewedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of receivers. */
export interface ReceiverListData {
  data: ReceiverData[];
  total: number;
  take: number;
  skip: number;
}

/** Chains a receiver wallet can be registered on. */
export type ReceiverWalletNetwork =
  | 'ethereum'
  | 'base'
  | 'arbitrum'
  | 'polygon'
  | 'stellar'
  | 'solana'
  | 'tron'
  | 'sepolia';

/** Body for `POST /v1/kyc/receivers/:receiverId/wallets`. */
export interface CreateReceiverWalletOptions {
  name?: string;
  network: ReceiverWalletNetwork;
  address: string;
  /**
   * Proof the receiver controls the address, for the secure-wallet flow: the hash
   * of the transaction that signed the message from
   * {@link KycManager.walletSignMessage}.
   */
  signature_tx_hash?: string;
  is_account_abstraction?: boolean;
}

/** Raw receiver wallet payload. */
export interface ReceiverWalletData {
  id: string;
  blindpayId: string;
  name: string | null;
  network: string;
  address: string | null;
  isAccountAbstraction: boolean;
  createdAt: string;
}

/** Raw paginated list of receiver wallets. */
export interface ReceiverWalletListData {
  data: ReceiverWalletData[];
  total: number;
  take: number;
  skip: number;
}

/** Fiat rails a bank account can be opened on. */
export type BankRail =
  | 'wire'
  | 'ach'
  | 'rtp'
  | 'pix'
  | 'pix_safe'
  | 'ted'
  | 'spei_bitso'
  | 'transfers_bitso';

/**
 * Body for `POST /v1/kyc/receivers/:receiverId/bank-accounts`.
 *
 * Only the fields every rail shares are named here. The rest — `pix_*`, `ted_*`,
 * `spei_*`, `swift_*`, `sepa_*`, `ach_cop_*`, some seventy of them — depend on
 * `type`, and the authority on which ones a given rail needs is
 * {@link KycManager.bankDetails}, at runtime. Enumerating them in a published type
 * would freeze a provider's field list into a release of this SDK and break the
 * day it adds a rail.
 */
export interface CreateBankAccountOptions {
  type: BankRail;
  /** Label for the account. */
  name: string;
  account_class?: 'individual' | 'business';
  account_type?: 'checking' | 'saving';
  beneficiary_name?: string;
  recipient_relationship?: string;
  account_number?: string;
  routing_number?: string;
  business_industry?: string;
  phone_number?: string;
  tax_id?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province_region?: string;
  country?: string;
  postal_code?: string;
  /** Rail-specific fields. See `bankDetails(rail)` for the ones a rail requires. */
  [key: string]: unknown;
}

/** Raw bank account payload. */
export interface BankAccountData {
  id: string;
  blindpayId: string;
  rail: string | null;
  name: string | null;
  country: string | null;
  createdAt: string;
}

/** Raw paginated list of bank accounts. */
export interface BankAccountListData {
  data: BankAccountData[];
  total: number;
  take: number;
  skip: number;
}

/** Body for `POST /v1/kyc/terms-of-service`. */
export interface InitiateTosOptions {
  redirect_url?: string;
  /** Attach the acceptance to an existing receiver. */
  receiver_id?: string;
  idempotency_key?: string;
}

/**
 * Raw terms-of-service response — a provider passthrough carrying the hosted URL
 * the receiver has to visit.
 */
export interface TermsOfServiceData {
  url?: string;
  [key: string]: unknown;
}

/** Raw upload response. `file_url` is what every `*_file` field expects. */
export interface KycUploadData {
  file_url?: string;
  [key: string]: unknown;
}

/** Raw response of the rails catalogue / a rail's field schema — passthroughs. */
export type KycRailsData = unknown;
export type BankDetailsData = unknown;

/** Raw response of the wallet sign-message challenge — a provider passthrough. */
export interface WalletSignMessageData {
  message?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment intent history
// ─────────────────────────────────────────────────────────────────────────────

/** One status change of a payment intent — `GET /v1/payment-intents/{id}/transitions`. */
export interface PaymentIntentTransitionData {
  id: string;
  intentId: string;
  fromStatus: PaymentIntentStatus;
  toStatus: PaymentIntentStatus;
  txHash?: string | null;
  /** Who moved it: `api`, `validate`, `observer` or `system`. */
  actor: string;
  reason?: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset registry
// ─────────────────────────────────────────────────────────────────────────────

/** Query for `GET /v1/assets`. */
export interface ListRegistryAssetsOptions {
  network?: 'public' | 'testnet';
  /** Only the entries whose issuer was checked against the named organization. */
  verified?: boolean;
}

/** One `(code, issuer)` pair the server vouches for — or lists, unverified. */
export interface RegistryAssetData {
  code: string;
  /** Issuing account, or `null` for native XLM. */
  issuer: string | null;
  name: string;
  /** Who issues it, for display next to the code. */
  issuerName: string;
  /** The issuer's own on-chain `home_domain`, or empty when it publishes none. */
  issuerDomain: string;
  /** The issuing account was checked against `issuerName` — identity, not quality. */
  verified: boolean;
  /** Stellar Asset Contract id, when wrapped for Soroban. */
  contract: string | null;
  flags: { authRevocable: boolean; clawback: boolean };
}

/** Raw `GET /v1/assets` response. */
export interface AssetRegistryData {
  network: 'public' | 'testnet';
  /** Monotonic registry version: compare it against a bundled copy. */
  version: number;
  data: RegistryAssetData[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Aliases (payment handles)
// ─────────────────────────────────────────────────────────────────────────────

export type AliasChallengePurpose = 'CLAIM' | 'ADD_ADDRESS' | 'RECOVER';

/** One verified address an alias points at. */
export interface AliasAddressData {
  id: string;
  address: string;
  network: string;
  label?: string | null;
  /** The default for this network. */
  isPrimary: boolean;
  /** When this address proved control of itself. */
  verifiedAt: string;
}

/** `GET /v1/aliases/resolve/{name}` — where to pay a handle. */
export interface AliasResolutionData {
  name: string;
  displayName: string;
  /** Every verified address on the requested network, primary first. */
  addresses: AliasAddressData[];
  /** The address to pay when the payer did not choose one. */
  primaryAddress?: string | null;
}

/** `GET /v1/aliases/availability/{name}`. */
export interface AliasAvailabilityData {
  name: string;
  available: boolean;
  /** Why not, when unavailable: `taken`, `reserved`, `bad_characters`, … */
  reason?: string | null;
}

/** `GET /v1/aliases/by-address/{address}`. */
export interface AliasByAddressData {
  data: { name: string; displayName: string; network: string; isPrimary: boolean }[];
}

/** Body for `POST /v1/aliases/challenges`. */
export interface CreateAliasChallengeOptions {
  /** The handle being claimed. */
  name: string;
  address: string;
  /** Network id: `public`, `testnet`, or a custom id. */
  network: string;
  purpose?: AliasChallengePurpose;
}

/** A nonce to sign — `POST /v1/aliases/challenges`. */
export interface AliasChallengeData {
  nonce: string;
  /** The EXACT string to digest and sign. Sign this, never a string you rebuilt. */
  message: string;
  /** Domain tag the digest is framed with. */
  domain: string;
  purpose: AliasChallengePurpose;
  expiresAt: string;
}

/** Body for `POST /v1/aliases`. */
export interface ClaimAliasOptions {
  name: string;
  /** Recovery mailbox — required at claim time. */
  email: string;
  /** The nonce from a CLAIM challenge. */
  nonce: string;
  /** base64 ed25519 over the challenge digest. */
  signature: string;
  /** Human label for this first address. */
  label?: string;
}

/** Body for `POST /v1/aliases/{name}/addresses`. */
export interface AddAliasAddressOptions {
  address: string;
  network: string;
  /** The nonce from an ADD_ADDRESS challenge. */
  nonce: string;
  signature: string;
  label?: string;
  /** Make this the address a payer gets when they do not ask for one. */
  primary?: boolean;
}

/** Body for `POST /v1/aliases/{name}/recovery/complete`. */
export interface CompleteAliasRecoveryOptions {
  /** The token delivered by email. */
  token: string;
  /** The address that will own the alias from now on. */
  address: string;
  network: string;
  /** The nonce from a RECOVER challenge. */
  nonce: string;
  signature: string;
}

/** An alias the caller owns. */
export interface OwnedAliasData {
  id: string;
  /** Normalized handle — the form uniqueness is decided on. */
  name: string;
  /** As the claimant typed it. Display only. */
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  addresses: AliasAddressData[];
  createdAt: string;
  email: string;
  emailVerifiedAt?: string | null;
}

/** Raw `GET /v1/aliases` page. */
export interface AliasListData {
  data: OwnedAliasData[];
  total: number;
  take: number;
  skip: number;
}

/** `DELETE` answers for aliases and alias addresses. */
export interface AliasDeletedData {
  id: string;
  deleted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alias recovery (email)
// ─────────────────────────────────────────────────────────────────────────────

/** Answer of `POST /v1/aliases/:name/recovery` — the same whether or not the mailbox matches. */
export interface AliasRecoveryStartedData {
  accepted: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared public key
// ─────────────────────────────────────────────────────────────────────────────

/** The shared public API key an open-source wallet embeds, per environment. */
export interface PublicKeyData {
  env: 'dev' | 'prod';
  apiKey: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────────────────────

/** A plugin this deployment serves, and this consumer's installation of it. */
export interface PluginData {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** What the plugin may do; installing is consenting to exactly this list. */
  capabilities: string[];
  /** Hosts the plugin may call out to. */
  egress: string[];
  config: Record<string, unknown>;
  queries: unknown[];
  commands: unknown[];
  events: unknown[];
  /** Null when this consumer has not installed it. */
  installation: Record<string, unknown> | null;
}

export interface PluginListData {
  data: PluginData[];
}

/** Body for `PUT /v1/plugins/:slug/installation`. */
export interface InstallPluginOptions {
  /** Exactly the capabilities the plugin declares — consent is all or nothing. */
  grantCapabilities: string[];
  config?: Record<string, unknown>;
}

export interface PluginUninstalledData {
  slug: string;
  uninstalled: boolean;
}

/** Result of a plugin query or command. */
export interface PluginActionResultData<T = unknown> {
  plugin: string;
  action: string;
  output: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// DeFindex vaults (native plugin, Stellar)
// ─────────────────────────────────────────────────────────────────────────────

/** Body for `POST /v1/defindex/vaults/:vault/deposit`. */
export interface DefindexDepositOptions {
  /** One amount per vault asset, in its base units. */
  amounts: string[];
  /** The account that signs. */
  caller: string;
  invest?: boolean;
  slippageBps?: number;
}

/** Body for `POST /v1/defindex/vaults/:vault/withdraw`. */
export interface DefindexWithdrawOptions {
  shares: string;
  caller: string;
  slippageBps?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merchant fees
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A merchant fee to charge on an operation: a percentage, a fixed amount or
 * both, paid on-chain to `wallet`. At least one of `bps` and `fixed` must be
 * above zero.
 */
export interface MerchantFeeOptions {
  /** The percentage part, in basis points (150 = 1.5%), at most 1000 (10%). Taken from `amount`, rounded down. */
  bps?: number;
  /** The fixed part, in the operation's asset, as a decimal with at most that asset's decimals. */
  fixed?: string;
  /** Where the fee is paid: an account on the chain the fee travels on. */
  wallet: string;
  /**
   * `recipient` (the default): deducted from `amount`, so the receiver gets less.
   * `payer`: added on top, so the payer sends `amount` plus the fee.
   */
  paidBy?: 'recipient' | 'payer';
}

/** The merchant fee an operation charged, as its record stores it. */
export interface MerchantFeeData {
  /** The percentage part, in basis points. */
  bps: number;
  /** The fixed part, in `asset`. */
  fixed: string;
  /** The fee charged: the percentage of `amount` plus the fixed part. */
  amount: string;
  /** The asset the fee is paid in. */
  asset: string;
  /** Where the fee is paid. */
  wallet: string;
  paidBy: 'recipient' | 'payer';
}

// ─────────────────────────────────────────────────────────────────────────────
// Private payments (`/v1/zk-payments`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where a private payment stands, as it reads now: a `PENDING` payment past
 * `expiresAt` reads `EXPIRED`, and can still settle with transfers that closed
 * in time.
 */
export const PrivatePaymentStatus = {
  Pending: 'PENDING',
  Succeeded: 'SUCCEEDED',
  Expired: 'EXPIRED',
} as const;
export type PrivatePaymentStatus =
  (typeof PrivatePaymentStatus)[keyof typeof PrivatePaymentStatus];

/** The Stellar network a private payment is on, set by the API key. */
export type PrivatePaymentNetwork = 'public' | 'testnet';

/** Body for `POST /v1/zk-payments`. */
export interface CreatePrivatePaymentOptions {
  /**
   * What the payer pays in total, in XLM (up to 7 decimal places). The merchant
   * receives it minus the 0.18% commission (`netAmount`); the commission
   * (`feeAmount`, rounded up, at least one stroop) goes to Cosmos Pay's fee
   * account. An amount whose net would be zero is refused.
   */
  amount: string;
  /**
   * The merchant's Stellar account (G...). It must already hold a confidential
   * account on Cosmos Pay's token, registered under auditor id 0; otherwise the
   * payment is refused with `recipient_not_registered`.
   */
  recipient: string;
  /**
   * Shown to the payer by the checkout (max 280 characters). Not secret and not
   * on-chain: the public read returns it to anyone holding the payment id.
   */
  description?: string;
  /** How long the payment stays payable, in minutes (1 to 10080; the server's default is 60). */
  expiresInMinutes?: number;
  /**
   * Idempotency key (max 255 characters), sent as the `Idempotency-Key` header
   * and in the body. A retry with the same key and request returns the existing
   * payment; the same key with a different request is `409 idempotency_conflict`.
   */
  idempotencyKey?: string;
  /**
   * Your own fee on this payment, in XLM, paid privately by a third confidential
   * transfer to `wallet`, which must already hold a confidential account on the
   * token (under auditor id 0) and be neither the recipient nor the fee account.
   */
  merchantFee?: MerchantFeeOptions;
}

/** Query for `GET /v1/zk-payments`. */
export interface ListPrivatePaymentsOptions {
  /** Only payments in this status, as it reads now. */
  status?: PrivatePaymentStatus;
  /** Page size (1 to 100, default 20). */
  take?: number;
  /** Offset (default 0). */
  skip?: number;
}

/** Raw private payment, as its owner (the merchant's API key) reads it. */
export interface PrivatePaymentData {
  /** The private payment id (a cuid). */
  id: string;
  status: PrivatePaymentStatus;
  network: PrivatePaymentNetwork;
  /** The confidential token every transfer must be made on. */
  tokenContract: string;
  /** What the payer pays in total, in XLM: `netAmount + feeAmount`, plus `merchantFee.amount` when there is one. */
  amount: string;
  /** What the merchant receives: `amount - feeAmount`, less `merchantFee.amount` when there is one. */
  netAmount: string;
  /** The commission: `ceil(amount * feeBps / 10000)` in stroops, at least one. */
  feeAmount: string;
  /** The commission rate the payment was priced at, in basis points. */
  feeBps: number;
  /** The merchant (G...). */
  recipient: string;
  /** Cosmos Pay's account the commission (`feeAmount`) is paid to. */
  feeAccount: string;
  /** The account the transfers came from, once settled. */
  payer: string | null;
  /** The transaction of the transfer that paid `netAmount` to the recipient, once settled. */
  paymentTxHash: string | null;
  /** The transaction of the transfer that paid `feeAmount` to the fee account, once settled. */
  feeTxHash: string | null;
  /** The merchant fee the request named; null without one. */
  merchantFee: MerchantFeeData | null;
  /** The merchant fee's transaction, once settled. */
  merchantFeeTxHash: string | null;
  /** The description given at create; null when none was given. */
  description: string | null;
  /** The idempotency key of the create: the one sent, or a generated `zkp_...` key. */
  idempotencyKey: string;
  /** When the payment stops being payable. Every transfer must close before it. */
  expiresAt: string;
  /** When the later of the transfers closed, once settled. */
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw paginated list of private payments, newest first. */
export interface PrivatePaymentListData {
  data: PrivatePaymentData[];
  total: number;
  take: number;
  skip: number;
}

/** Cosmos Pay's confidential token on one network. */
export interface PrivatePaymentTokenData {
  /** The confidential token contract (C...). */
  contractId: string;
  /** What it wraps: native XLM. */
  symbol: string;
  /** Decimal places of the token's amounts (7, as for XLM). */
  decimals: number;
  /** Native XLM's Stellar Asset Contract on this network. */
  underlying: string;
  /** The ledger the token was deployed at: where a wallet replays its confidential balance from. */
  deployedAtLedger: number;
}

/**
 * Raw private payments setup of the API key's network (`GET /v1/zk-payments/config`):
 * the token, registries, auditor id, commission and fee account a wallet
 * registers, proves and pays against. Everything in it is public on-chain data
 * or a public URL.
 */
export interface PrivatePaymentsConfigData {
  /**
   * Whether private payments run on this network. False where they do not run
   * yet (mainnet today); every other field but `network`, `networkPassphrase`,
   * `auditorId` and `feeBps` is then null.
   */
  enabled: boolean;
  network: PrivatePaymentNetwork;
  /** The Soroban RPC to build and submit transactions through. */
  rpcUrl: string | null;
  /** The Stellar network passphrase of `network`. */
  networkPassphrase: string;
  /** Cosmos Pay's confidential token on this network; null when `enabled` is false. */
  token: PrivatePaymentTokenData | null;
  /** The UltraHonk verifier registry the token checks proofs with. */
  verifier: string | null;
  /** The auditor registry holding Cosmos Pay's key. */
  auditorRegistry: string | null;
  /** The auditor id every account on the token registers under. */
  auditorId: number;
  /** The commission, in basis points (18 = 0.18%). */
  feeBps: number;
  /** Cosmos Pay's account the commission is transferred to. */
  feeAccount: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// USDT0 (Stellar to EVM networks through LayerZero)
// ─────────────────────────────────────────────────────────────────────────────

/** Where a USDT0 transfer stands. DELIVERED, FAILED and EXPIRED are final. */
export const Usdt0TransferStatus = {
  /** Built, waiting for the signature. */
  Pending: 'PENDING',
  /** On the Stellar ledger; LayerZero is delivering it. */
  Submitted: 'SUBMITTED',
  /** Credited on the destination network. */
  Delivered: 'DELIVERED',
  /** The Stellar transaction failed, or LayerZero gave up on the message. */
  Failed: 'FAILED',
  /** Never reached the ledger before `expiresAt`. */
  Expired: 'EXPIRED',
} as const;
export type Usdt0TransferStatus =
  (typeof Usdt0TransferStatus)[keyof typeof Usdt0TransferStatus];

/**
 * A network USDT0 can be sent to from Stellar (`GET /v1/usdt0/routes`). `eth`
 * receives native USDT; every other network receives USDT0.
 */
export type Usdt0Destination =
  | 'eth'
  | 'arb'
  | 'bera'
  | 'conflux'
  | 'flare'
  | 'hedera'
  | 'hyperevm'
  | 'ink'
  | 'mantle'
  | 'megaeth'
  | 'monad'
  | 'morph'
  | 'op'
  | 'plasma'
  | 'pol'
  | 'rootstock'
  | 'sei'
  | 'stable'
  | 'tempo'
  | 'unichain'
  | 'xlayer';

/** What arrives: native `USDT` on Ethereum, `USDT0` everywhere else. */
export type Usdt0Receives = 'USDT' | 'USDT0';

/** Body for `POST /v1/usdt0/quote`. Nothing is persisted. */
export interface QuoteUsdt0Options {
  /** The destination network. */
  to: Usdt0Destination;
  /**
   * USDT0 to send, decimal with up to 7 places. The OFT carries 6: a 7th decimal
   * is dust that stays in the account.
   */
  amount: string;
  /** The account the quote is simulated as. Omitted, a fixed mainnet account is used; the price is the same. */
  source?: string;
}

/** Body for `POST /v1/usdt0/transfers`. */
export interface CreateUsdt0TransferOptions {
  /** The Stellar account that holds the USDT0, signs the transaction and pays its fees in XLM. */
  source: string;
  /** The destination network. */
  to: Usdt0Destination;
  /** The EVM address credited on the destination network (0x + 40 hex; a mixed-case one must be valid EIP-55). */
  recipient: string;
  /** USDT0 to send, decimal with up to 7 places (a 7th decimal is dust that stays in the account). */
  amount: string;
  /**
   * Idempotency key, sent as the `Idempotency-Key` header and in the body. A retry
   * with the same key and request returns the stored transfer; the same key with a
   * different request is `409 idempotency_conflict`.
   */
  idempotencyKey?: string;
  /**
   * Your own fee on this transfer, in USDT0, paid to `wallet` (a Stellar account
   * that trusts USDT0) in the same transaction. Needs a deployment with the fee
   * wrapper configured; otherwise `400 merchant_fee_unsupported`.
   */
  merchantFee?: MerchantFeeOptions;
}

/** Query for `GET /v1/usdt0/transfers`. */
export interface ListUsdt0TransfersOptions {
  /** Only transfers in this status, as last refreshed. */
  status?: Usdt0TransferStatus;
  /** Page size (max 100, default 20). */
  take?: number;
  /** Offset (default 0). */
  skip?: number;
}

/** Body for `POST /v1/usdt0/transfers/:id/submit`. */
export interface SubmitUsdt0TransferOptions {
  /** The signed transaction envelope (base64 XDR): the one the API built, carrying a signature. */
  signedXdr: string;
}

/**
 * Sent as `X-Record-Token` on the read and submit of one transfer. Required only
 * when the client uses the shared public key: it is the `publicToken` the create
 * returned. Every other key ignores it.
 */
export interface Usdt0RecordTokenOptions {
  recordToken?: string;
}

/** Raw USDT0 quote: what is sent and arrives, the fees and the OFT's limits. */
export interface Usdt0QuoteData {
  to: Usdt0Destination;
  /** The destination network's LayerZero endpoint id. */
  eid: number;
  receives: Usdt0Receives;
  /** The amount asked for. */
  amount: string;
  /** Cosmos Pay's plan commission rate, in basis points (0 when the deployment has no fee wrapper). */
  feeBps: number;
  /** The commission in USDT0, out of `amount`, rounded down. */
  feeAmount: string;
  /** What the OFT takes from the account: `amount` without its dust. */
  amountSent: string;
  /** What arrives on the destination network. */
  amountReceived: string;
  /** The 7th decimal the OFT cannot carry; it stays in the account. */
  dust: string;
  /** LayerZero's messaging fee, in XLM, paid on top of the USDT0. */
  nativeFee: string;
  /** What a transfer built now would offer LayerZero, in XLM (`nativeFee` plus 20%, the excess refunded). */
  nativeFeeLimit: string;
  /** The smallest amount the OFT accepts, in USDT0. */
  minAmount: string;
  /** The largest amount the OFT accepts, in USDT0. */
  maxAmount: string;
}

/** Raw USDT0 transfer from Stellar to an EVM network. */
export interface Usdt0TransferData {
  /** The transfer's id, used by the read and submit routes. */
  id: string;
  status: Usdt0TransferStatus;
  /** Always mainnet (`public`). */
  network: string;
  /** The Stellar account that holds the USDT0, signs the transaction and pays its fees in XLM. */
  source: string;
  to: Usdt0Destination;
  /** The destination network's LayerZero endpoint id. */
  eid: number;
  receives: Usdt0Receives;
  /** The EVM address credited, EIP-55. */
  recipient: string;
  /** The amount asked for. */
  amount: string;
  /** What the OFT takes from the account: `amount` without its dust. */
  amountSent: string;
  /** What arrives, and the on-chain floor: the transaction fails rather than deliver less. */
  amountReceived: string;
  /** The dust left in the account (`amount` - `amountSent`). */
  dust: string;
  /** LayerZero's quoted messaging fee, in XLM. */
  nativeFee: string;
  /** What the transaction offers LayerZero, in XLM: `nativeFee` plus a 20% buffer, the rest refunded. */
  nativeFeeLimit: string;
  /** The Stellar network fee, in XLM. */
  networkFee: string;
  /** Cosmos Pay's plan commission rate, in basis points. */
  feeBps: number;
  /** The commission in USDT0, out of `amount`. */
  feeAmount: string;
  /** Where the commission went; null without one. */
  feeWallet: string | null;
  /** The unsigned transaction (base64 XDR) to sign. */
  xdr: string;
  /** A SEP-7 `tx` link carrying `xdr`. */
  uri: string;
  /**
   * A QR of `uri` as a PNG data URL, or null when the transaction is too large for
   * one (a Soroban transaction usually is). Absent from list rows.
   */
  qr?: string | null;
  /** The Stellar transaction hash once it reached the network; null while PENDING or EXPIRED. */
  txHash: string | null;
  /** LayerZero's message id (0x + 64 hex), once the transaction landed. */
  guid: string | null;
  /** The destination network's transaction, once DELIVERED. */
  destinationTxHash: string | null;
  /** LayerZero Scan's own status word, verbatim (`INFLIGHT`, `CONFIRMING`, `DELIVERED`, ...). */
  scanStatus: string | null;
  /** The transaction on LayerZero Scan, once it reached the network. */
  scanUrl: string | null;
  /** Why a FAILED transfer failed. */
  failureReason: string | null;
  /** The merchant fee the request named, in USDT0; null without one. */
  merchantFee: MerchantFeeData | null;
  /** The Idempotency-Key it was created with, if any. */
  idempotencyKey: string | null;
  /** When the transaction's time bounds close: submit refuses it afterwards. */
  expiresAt: string;
  /** When it was first seen accepted by the network. */
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Only on the create, and only when the caller is the shared public key: this
   * record's read token, to send as `X-Record-Token` when reading or submitting it.
   */
  publicToken?: string;
}

/** Raw paginated list of USDT0 transfers, newest first, as last refreshed. */
export interface Usdt0TransferListData {
  data: Usdt0TransferData[];
  total: number;
  take: number;
  skip: number;
}

/** Raw outcome of relaying a signed USDT0 transaction. */
export interface Usdt0SubmitOutcomeData {
  /** True when the network accepted the transaction (SUBMITTED, or already DELIVERED). */
  submitted: boolean;
  /** The transfer's status after this submission. */
  status: Usdt0TransferStatus;
  /** The Stellar transaction hash, once it reached the network. */
  txHash?: string;
  /** Why it was not submitted, when `submitted` is false. */
  reason?: string | null;
  /** The transfer after this submission. */
  transfer: Usdt0TransferData;
}

/** USDT0 on Stellar: the classic asset and its Stellar Asset Contract. */
export interface Usdt0TokenData {
  code: string;
  issuer: string;
  contract: string;
}

/** One destination network USDT0 can be sent to from Stellar. */
export interface Usdt0RouteData {
  /** The id requests name this network with (`to`). */
  chain: Usdt0Destination;
  /** The network's display name. */
  name: string;
  /** LayerZero endpoint id. */
  eid: number;
  receives: Usdt0Receives;
}

/** Raw `GET /v1/usdt0/routes`: where USDT0 can go, with the token and OFT a transfer uses. */
export interface Usdt0RoutesData {
  /** Always `public`: USDT0 exists on Stellar mainnet only. */
  network: string;
  /** True for a prod (mainnet) key; a dev (testnet) key gets `false` and no routes. */
  available: boolean;
  token: Usdt0TokenData;
  /** The LayerZero OFT contract the transaction calls (`send`). */
  oft: string;
  /** Stellar mainnet's LayerZero endpoint id. */
  eid: number;
  /** The destination networks, Ethereum first and then by name. */
  routes: Usdt0RouteData[];
}
