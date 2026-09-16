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
export interface CreatePayPaymentIntentOptions {
  /** Payee's Stellar account. A registered address-book name also works. */
  destination: string;
  /** Amount the destination should receive. Omit to let the user enter it (e.g. donations). */
  amount?: string;
  /**
   * Typed asset (e.g. `Assets.USDC` or `defineAsset(...)`) — fills `assetCode`
   * and `assetIssuer` for you. Takes a back seat to explicit code/issuer below.
   */
  asset?: AssetRef;
  /** Asset code the destination receives. Omit for native lumens (XLM). */
  assetCode?: string;
  /** Issuer account for a non-native asset. */
  assetIssuer?: string;
  /** MEMO_ID (numeric uint64) for idempotency + on-chain identification. Auto-generated when omitted. */
  memo?: string;
  /** SEP-7 `msg`: shown to the user in their wallet (≤ 300 chars). */
  msg?: string;
  /** SEP-7 `callback`, e.g. `url:https://...`. */
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

/** Body for `POST /v1/customers`. */
export interface CreateCustomerOptions {
  name: string;
  alias?: string;
  note?: string;
  email?: string;
  /** Optional Stellar account to associate the customer with. */
  account?: string;
  reference?: string;
}

/** Body for `PATCH /v1/customers/:id`. */
export type UpdateCustomerOptions = Partial<CreateCustomerOptions>;

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

/** Body for `POST /v1/swaps/quote` (pricing only; no fee parameter — the fee is enforced server-side per organization). */
export interface QuoteSwapOptions {
  /** Amount to send, as a decimal string (max 7 decimals). */
  amount: string;
  /** Source asset code. Omit (or `XLM`/`native`) for native lumens. */
  sourceAssetCode?: string;
  /** Issuer account for a non-native source asset. */
  sourceAssetIssuer?: string;
  /** Destination asset code the swap should deliver. */
  destAssetCode: string;
  /** Issuer account for a non-native destination asset. */
  destAssetIssuer?: string;
  /** Allowed slippage in basis points. */
  slippageBps?: number;
}

/** Body for `POST /v1/swaps`. */
export interface CreateSwapOptions extends QuoteSwapOptions {
  /** Source account performing the swap. A registered address-book name also works. */
  source: string;
  /** Destination account that receives the swapped asset. Defaults to the source. */
  destination?: string;
  /** MEMO_ID (numeric uint64) for idempotency + on-chain identification. */
  memo?: string;
}

/** Body for `POST /v1/swaps/:id/submit`. */
export interface SubmitSwapOptions {
  /** Signed transaction envelope (base64 XDR) to relay to the network. */
  signedXdr: string;
}

/** Query for `GET /v1/swaps`. */
export interface ListSwapsOptions {
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
  source: { asset: string; issuer: string | null; amount: string };
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
// Pollar (social login + custodial wallets)
// ─────────────────────────────────────────────────────────────────────────────

/** Identity providers a Pollar login can go through. */
export type PollarProvider = 'google' | 'github';

/** State of a login, polled between the redirect and the token exchange. */
export type PollarLoginStatus =
  | 'pending'
  | 'authorized'
  | 'exchanging'
  | 'consumed'
  | 'failed'
  | 'expired';

/** A Pollar wallet, as returned alongside a session or a registration. */
export interface PollarWalletData {
  type: 'internal' | 'smart' | 'external';
  address: string | null;
  chain: 'STELLAR' | 'POLYGON' | 'SOLANA';
  /** False until the reserve is funded — see {@link PollarManager.activateWallet}. */
  exists_on_stellar?: boolean;
  funding_mode?: 'IMMEDIATE' | 'DEFERRED';
  network?: string;
}

/** The public half of the DPoP key a client binds its session to. */
export interface PollarDpopJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

/** The fields both login flows accept. */
export interface PollarAuthorizeBaseOptions {
  provider: PollarProvider;
  code_challenge_method?: 'S256';
  /** Binds the resulting session to a key this client holds. */
  dpop_jwk?: PollarDpopJwk;
  /** Shown to the user in their session list. */
  device_label?: string;
}

/**
 * Body for `POST /v1/pollar/oauth/authorize`.
 *
 * The code that comes back is redeemed with the `code_verifier` the challenge was
 * derived from, so an intercepted code is worth nothing without the client that
 * started the flow. How much that matters depends on the flow, and the type follows:
 *
 *  - **Redirect** (`redirect_uri` set): `code_challenge` is required. The code crosses
 *    a browser, and the public callback hands it to whoever presents `state` — which
 *    is inside `authorization_url` — so the service answers `400 validation_failed`
 *    to a redirect-flow authorize without one.
 *  - **Poll** (no `redirect_uri`): the code only travels over your authenticated
 *    channel, so PKCE is optional. Send it anyway.
 */
export type PollarAuthorizeOptions =
  | (PollarAuthorizeBaseOptions & {
      /** Where the browser lands with the code. Must be allow-listed for the consumer. */
      redirect_uri: string;
      /** Base64url SHA-256 of the verifier held by the client. */
      code_challenge: string;
    })
  | (PollarAuthorizeBaseOptions & {
      redirect_uri?: undefined;
      /** Base64url SHA-256 of the verifier held by the client. */
      code_challenge?: string;
    });

/** Raw authorize response — where to send the user, and what to poll. */
export interface PollarAuthorizeData {
  /** Correlates the login. Poll `sessions/{state}` with it. */
  state: string;
  /** The URL to open for the user. */
  authorization_url: string;
  provider: PollarProvider;
  redirect_uri: string | null;
  expires_at: string;
}

/** Raw polling response for a login in progress. */
export interface PollarLoginSessionData {
  status: PollarLoginStatus;
  state: string;
  /** The bridge code to redeem — present once `status` is `authorized`. */
  code?: string;
  code_expires_at?: string | null;
  error_code?: string | null;
}

/** Body for `POST /v1/pollar/oauth/token`. */
export interface PollarTokenOptions {
  /** The bridge code collected from the polled session. */
  code: string;
  /** The PKCE verifier the challenge was derived from. Required when `authorize` sent a `code_challenge`. */
  code_verifier?: string;
}

/** A user profile as Pollar knows it. */
export interface PollarProfileData {
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  [key: string]: unknown;
}

/** Raw Pollar session — the tokens, the wallets and the profile. */
export interface PollarSessionData {
  access_token: string;
  refresh_token?: string;
  token_type?: 'Bearer' | 'DPoP';
  /** Unix seconds. */
  expires_at?: number;
  user_id?: string | null;
  /** The primary wallet; `wallets` carries the rest. */
  wallet?: PollarWalletData;
  wallets?: PollarWalletData[];
  profile?: PollarProfileData;
}

/** Body for `POST /v1/pollar/oauth/refresh`. */
export interface PollarRefreshOptions {
  refresh_token: string;
}

/** Raw rotated token pair. */
export interface PollarRefreshData {
  access_token: string;
  refresh_token?: string;
  token_type?: 'Bearer';
  expires_at?: number;
}

/** Body for `POST /v1/pollar/oauth/logout`. */
export interface PollarLogoutOptions {
  access_token: string;
  /** Revoke every device, not just this one. */
  everywhere?: boolean;
}

/** How many sessions the logout revoked. */
export interface PollarLogoutData {
  revoked: number;
}

/** Body for `POST /v1/pollar/wallets/activate`. */
export interface ActivatePollarWalletOptions {
  public_key: string;
}

/** Raw activation result — the reserve that was funded. */
export interface PollarActivationData {
  public_key: string;
  /** XLM sent to cover the base reserve. */
  amount: string;
  activated: boolean;
}

/** One asset to enable on a wallet. */
export interface PollarTrustlineAsset {
  code: string;
  issuer: string;
}

/** Body for `POST /v1/pollar/wallets/:address/trustlines`. */
export interface PollarTrustlinesOptions {
  assets: PollarTrustlineAsset[];
}

/** Raw trustline result — a status code for the operation. */
export interface PollarTrustlineData {
  code: string;
  [key: string]: unknown;
}

/** Body for `POST /v1/pollar/users` and `/users/with-wallet`. */
export interface RegisterPollarUserOptions {
  /** Your own id for this user — how you find them again. */
  external_id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
}

/** Raw registration result. */
export interface PollarUserData {
  external_id: string;
  code: 'SERVER_USER_REGISTERED' | 'SERVER_USER_WALLET_CREATED';
  user_id: string | null;
  wallet?: PollarWalletData;
}

/** Body for `POST /v1/pollar/tokens/verify`. */
export interface VerifyPollarTokenOptions {
  token: string;
}

/** Raw verification result — who the token belongs to, and until when. */
export interface PollarTokenVerificationData {
  user_id: string;
  application_id: string;
  /** Unix seconds. */
  expires_at: number;
  network?: string;
  auth_provider?: string;
  wallet?: PollarWalletData;
}
