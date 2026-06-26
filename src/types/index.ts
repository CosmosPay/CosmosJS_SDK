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

/** Raw customer payload. */
export interface CustomerData {
  id: string;
  consumerId: string;
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
